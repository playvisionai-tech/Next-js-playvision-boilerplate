import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkMarkdown, isLocalPath, listMarkdownFiles, parseLinks } from '../check-links.js';

// fileURLToPath, not URL.pathname: the latter keeps a leading slash before the
// drive letter on Windows and leaves %20 in place of a space, so a checkout in
// "My Projects" resolved to a directory that does not exist.
const SCRIPTS_DIR = fileURLToPath(new URL('..', import.meta.url));

const tempDirs: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function write(dir: string, file: string, body: string): void {
  const full = path.join(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

// Run the real script inside a throwaway repo, so the CLI's own wiring runs too.
function runChecker(dir: string, ...args: string[]): { status: number; output: string } {
  const result = spawnSync(process.execPath, [path.join(dir, 'scripts/check-links.js'), ...args], {
    cwd: dir,
    encoding: 'utf-8',
  });

  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

describe('scripts/check-links.js', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  // Realpath-resolved: macOS's /var -> /private/var symlink otherwise makes
  // fixture paths disagree with the answers git gives for the same repository.
  function tempDir(prefix: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    tempDirs.push(dir);
    return dir;
  }

  // A real repository, insulated from whatever the developer's own git config does.
  function initRepo(): string {
    const dir = tempDir('check-links-repo-');
    git(dir, 'init', '-q', '-b', 'main', '.');
    git(dir, 'config', 'user.email', 'link-rot@example.test');
    git(dir, 'config', 'user.name', 'Link Rot');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'config', 'core.hooksPath', path.join(dir, 'no-hooks'));
    write(
      dir,
      'scripts/check-links.js',
      fs.readFileSync(path.join(SCRIPTS_DIR, 'check-links.js'), 'utf-8'),
    );
    return dir;
  }

  // A tree with a couple of real files to point at, for the rules that only
  // read the filesystem.
  function documentedTree(): string {
    const dir = tempDir('check-links-tree-');
    write(dir, 'docs/guide.md', '# guide\n\n## a heading\n');
    write(dir, 'docs/nested/deep.md', '# deep\n');
    return dir;
  }

  describe(parseLinks, () => {
    it('reads the destination and the line it was written on', () => {
      expect(parseLinks('intro\n\nsee [the guide](docs/guide.md) for more\n')).toStrictEqual([
        { target: 'docs/guide.md', line: 3 },
      ]);
    });

    it('reads both destinations of a linked image', () => {
      // `[![alt](img.png)](page.md)` is how every badge and screenshot in a
      // README is written. A pattern anchored on the opening bracket matches
      // the inner image and walks straight past the page.
      expect(parseLinks('[![alt](shot.png)](page.md)\n').map((link) => link.target)).toStrictEqual([
        'shot.png',
        'page.md',
      ]);
    });

    it('unwraps an angle-bracketed destination', () => {
      expect(parseLinks('[a](<my file.md>)\n')[0]?.target).toBe('my file.md');
    });

    it('drops a quoted title', () => {
      expect(parseLinks('[a](docs/guide.md "The Guide")\n')[0]?.target).toBe('docs/guide.md');
    });

    it('ignores link syntax inside a fenced code block', () => {
      // A link in a code block is an example of markdown, not a link a reader
      // can follow.
      const text = ['before', '```md', '[a](nope.md)', '```', '[b](docs/guide.md)'].join('\n');

      expect(parseLinks(text).map((link) => link.target)).toStrictEqual(['docs/guide.md']);
    });
  });

  describe(isLocalPath, () => {
    it('claims a relative path', () => {
      expect(isLocalPath('docs/guide.md')).toBeTruthy();
      expect(isLocalPath('../AGENTS.md')).toBeTruthy();
    });

    it('disclaims destinations that leave this machine', () => {
      expect(isLocalPath('https://example.com')).toBeFalsy();
      expect(isLocalPath('http://example.com')).toBeFalsy();
      expect(isLocalPath('mailto:someone@example.com')).toBeFalsy();
    });

    it('disclaims an anchor and an empty destination', () => {
      expect(isLocalPath('#a-heading')).toBeFalsy();
      expect(isLocalPath('')).toBeFalsy();
    });
  });

  describe(checkMarkdown, () => {
    it('says nothing about a link that resolves', () => {
      const root = documentedTree();

      expect(checkMarkdown(root, 'README.md', 'see [the guide](docs/guide.md)\n')).toStrictEqual({
        checked: 1,
        problems: [],
      });
    });

    it('reports a link to a file that is not there, with its line', () => {
      const root = documentedTree();
      const { problems } = checkMarkdown(
        root,
        'README.md',
        '# title\n\n![shot](public/shot.png)\n',
      );

      expect(problems).toHaveLength(1);
      expect(problems[0]?.file).toBe('README.md');
      expect(problems[0]?.line).toBe(3);
      expect(problems[0]?.message).toContain('public/shot.png');
      expect(problems[0]?.message).toContain('does not exist');
    });

    it('resolves relative to the file the link is written in, not the root', () => {
      const root = documentedTree();

      // `nested/deep.md` resolves from docs/, and would not from the root.
      expect(
        checkMarkdown(root, 'docs/guide.md', '[deep](nested/deep.md)\n').problems,
      ).toStrictEqual([]);
      expect(checkMarkdown(root, 'README.md', '[deep](nested/deep.md)\n').problems).toHaveLength(1);
    });

    it('checks nothing in an external URL', () => {
      const root = documentedTree();

      expect(
        checkMarkdown(root, 'README.md', '[demo](https://demo.example.com/sign-up)\n'),
      ).toStrictEqual({ checked: 0, problems: [] });
    });

    it('checks nothing in an anchor-only link', () => {
      const root = documentedTree();

      expect(checkMarkdown(root, 'README.md', '[jump](#a-heading)\n')).toStrictEqual({
        checked: 0,
        problems: [],
      });
    });

    it('accepts a fragment on a file that exists, without judging the fragment', () => {
      const root = documentedTree();

      // The document is verified; whether it has that heading is out of scope.
      expect(checkMarkdown(root, 'README.md', '[here](docs/guide.md#a-heading)\n')).toStrictEqual({
        checked: 1,
        problems: [],
      });
      expect(
        checkMarkdown(root, 'README.md', '[here](docs/guide.md#no-such-heading)\n').problems,
      ).toStrictEqual([]);
    });

    it('still reports a fragment hung off a file that is not there', () => {
      const root = documentedTree();

      expect(
        checkMarkdown(root, 'README.md', '[here](docs/gone.md#a-heading)\n').problems,
      ).toHaveLength(1);
    });

    it('accepts a link to a directory', () => {
      const root = documentedTree();

      expect(checkMarkdown(root, 'README.md', '[docs](docs)\n').problems).toStrictEqual([]);
    });

    it('decodes percent escapes before looking on disk', () => {
      const root = documentedTree();
      write(root, 'docs/my file.md', '# spaced\n');

      expect(checkMarkdown(root, 'README.md', '[a](docs/my%20file.md)\n').problems).toStrictEqual(
        [],
      );
    });

    it('reads a leading slash as the repository root', () => {
      const root = documentedTree();

      expect(
        checkMarkdown(root, 'docs/nested/deep.md', '[a](/docs/guide.md)\n').problems,
      ).toStrictEqual([]);
    });

    it('does not check a path that is only in backticks', () => {
      // Measured on this repository: flagging backticked paths surfaces 58
      // items of which about 4 are real, because prose uses relative shorthand
      // and package names that are not paths.
      const root = documentedTree();

      expect(
        checkMarkdown(root, 'README.md', 'put it in `server/` next to `features/a`\n'),
      ).toStrictEqual({ checked: 0, problems: [] });
    });
  });

  describe(listMarkdownFiles, () => {
    it('scans tracked markdown only, not scratch notes or ignored output', () => {
      const dir = initRepo();
      write(dir, 'docs/kept.md', '# kept\n');
      write(dir, '.gitignore', 'out/\n');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', 'docs: seed');
      write(dir, 'scratch.md', '[a](nope.md)\n');
      write(dir, 'out/generated.md', '[a](nope.md)\n');

      expect(listMarkdownFiles(dir)).toStrictEqual(['docs/kept.md']);
    });
  });

  describe('the checker as CI runs it', () => {
    it('passes and says how much it checked', () => {
      const dir = initRepo();
      write(dir, 'docs/guide.md', '# guide\n');
      write(dir, 'README.md', '[guide](docs/guide.md) and [demo](https://example.com)\n');
      git(dir, 'add', '-A');

      const { status, output } = runChecker(dir);

      expect(status).toBe(0);
      expect(output).toContain('1 relative link(s)');
      expect(output).toContain('all resolve');
    });

    it('fails, naming the file, the line and the destination', () => {
      const dir = initRepo();
      write(dir, 'README.md', '# title\n\n![shot](public/assets/images/sign-in.png)\n');
      git(dir, 'add', '-A');

      const { status, output } = runChecker(dir);

      expect(status).toBe(1);
      expect(output).toContain('README.md:3');
      expect(output).toContain('public/assets/images/sign-in.png');
    });

    it('ignores a broken link in an untracked file', () => {
      const dir = initRepo();
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', 'chore: vendor the checker');
      write(dir, 'scratch.md', '[a](nope.md)\n');

      expect(runChecker(dir).status).toBe(0);
    });
  });
});
