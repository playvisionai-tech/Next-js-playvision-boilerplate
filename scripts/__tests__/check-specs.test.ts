import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  collectChanges,
  collectSkipRequests,
  groupByModule,
  inspect,
  parseArgs,
} from '../check-specs.js';

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
  const result = spawnSync(process.execPath, [path.join(dir, 'scripts/check-specs.js'), ...args], {
    cwd: dir,
    encoding: 'utf-8',
  });

  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

describe('scripts/check-specs.js', () => {
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

  function commit(dir: string, message: string): void {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '--allow-empty', '-m', message);
  }

  // A real repository, insulated from whatever the developer's own git config does.
  function initRepo(): string {
    const dir = tempDir('check-specs-repo-');
    git(dir, 'init', '-q', '-b', 'main', '.');
    git(dir, 'config', 'user.email', 'spec-drift@example.test');
    git(dir, 'config', 'user.name', 'Spec Drift');
    // A global commit.gpgsign or hooksPath turns every fixture below into a flake
    // on someone else's machine.
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'config', 'core.hooksPath', path.join(dir, 'no-hooks'));
    return dir;
  }

  // One documented slice, with `base` marking the fork point.
  function seededRepo(): string {
    const dir = initRepo();
    write(dir, 'src/features/example/spec.md', '# example\n\nShows a note form.\n');
    write(dir, 'src/features/example/note-form.tsx', 'export const version = 1;\n');
    commit(dir, 'feat: seed the example slice');
    git(dir, 'branch', 'base');
    return dir;
  }

  // A tree with no git history, for the rules that only read the filesystem.
  function documentedTree(withSpec: boolean): string {
    const dir = tempDir('check-specs-tree-');
    fs.mkdirSync(path.join(dir, 'src/features/example'), { recursive: true });

    if (withSpec) {
      fs.writeFileSync(path.join(dir, 'src/features/example/spec.md'), '# example\n');
    }

    return dir;
  }

  function repoWithChecker(): string {
    const dir = seededRepo();

    for (const file of ['check-specs.js', 'spec-modules.js']) {
      write(
        dir,
        path.join('scripts', file),
        fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8'),
      );
    }

    commit(dir, 'chore: vendor the checker');
    git(dir, 'branch', '-f', 'base', 'HEAD');
    return dir;
  }

  describe(parseArgs, () => {
    it('defaults to local mode', () => {
      expect(parseArgs([])).toStrictEqual({ base: null });
    });

    it('accepts both spellings of --base', () => {
      expect(parseArgs(['--base', 'main'])).toStrictEqual({ base: 'main' });
      expect(parseArgs(['--base=origin/main'])).toStrictEqual({ base: 'origin/main' });
    });

    it('rejects --base with no ref', () => {
      expect(() => parseArgs(['--base'])).toThrow('--base requires a git ref');
      expect(() => parseArgs(['--base='])).toThrow('--base requires a git ref');
    });

    it('rejects a swallowed flag rather than treating it as a ref name', () => {
      // `--base --oops` would otherwise reach git as a ref, and the failure would
      // read like a missing branch instead of a typo.
      expect(() => parseArgs(['--base', '--oops'])).toThrow('--base requires a git ref');
    });

    it('rejects an unknown argument', () => {
      expect(() => parseArgs(['--since', 'main'])).toThrow('Unknown argument: --since');
    });
  });

  describe(collectSkipRequests, () => {
    it('honours a Spec-Skip trailer and reports its reason', () => {
      const dir = seededRepo();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      commit(
        dir,
        'refactor: rename a local\n\nSpec-Skip: internal rename, nothing observable moved',
      );

      expect(collectSkipRequests(dir, 'base')).toStrictEqual([
        'internal rename, nothing observable moved',
      ]);
    });

    it('ignores the token mid-sentence in a body', () => {
      const dir = seededRepo();
      commit(dir, 'docs: talk about it\n\nA body that says Spec-Skip: here, mid sentence.');

      expect(collectSkipRequests(dir, 'base')).toStrictEqual([]);
    });

    it('ignores a body paragraph that documents the trailer', () => {
      // This is the commit that broke the previous check: it described the escape
      // hatch, so a substring search found the token and waived its own range.
      const dir = seededRepo();
      commit(
        dir,
        [
          'docs: describe the escape hatch',
          '',
          'Put a trailer on the commit:',
          '',
          'Spec-Skip: <reason>',
          '',
          'It stays in the commit list, so a reviewer can question it.',
        ].join('\n'),
      );

      expect(collectSkipRequests(dir, 'base')).toStrictEqual([]);
    });

    it('refuses a trailer with no reason', () => {
      const dir = seededRepo();
      commit(dir, 'chore: quiet the check\n\nSpec-Skip:');

      expect(collectSkipRequests(dir, 'base')).toStrictEqual([]);
    });

    it('does not read commits the diff never inspects', () => {
      // base...HEAD is merge-base, so a skip commit that landed on the base
      // branch is not part of this change. Reading it would disable freshness for
      // every branch forked before it.
      const dir = seededRepo();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      commit(dir, 'chore: landed on main\n\nSpec-Skip: waived for its own change');

      git(dir, 'checkout', '-q', '-b', 'forked-earlier', 'base');
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 3;\n');
      commit(dir, 'feat: unrelated later work');

      expect(git(dir, 'log', '--format=%s', 'main...HEAD')).toContain('chore: landed on main');
      expect(git(dir, 'log', '--format=%s', 'main..HEAD')).not.toContain('chore: landed on main');
      expect(collectSkipRequests(dir, 'main')).toStrictEqual([]);
    });

    it('never honours a skip in local mode', () => {
      // Local mode inspects uncommitted work; HEAD's message describes the commit
      // before it, so a trailer there waives changes it was never written about.
      const dir = seededRepo();
      commit(dir, 'chore: something internal\n\nSpec-Skip: valid for the commit it is on');

      expect(collectSkipRequests(dir, 'base')).toStrictEqual(['valid for the commit it is on']);
      expect(collectSkipRequests(dir, null)).toStrictEqual([]);
    });

    it('treats an unknown base as no skip rather than failing the build', () => {
      expect(collectSkipRequests(seededRepo(), 'no-such-ref')).toStrictEqual([]);
    });
  });

  describe(collectChanges, () => {
    it('reports both ends of a cross-module rename', () => {
      const dir = seededRepo();
      write(dir, 'src/features/dest/spec.md', '# dest\n');
      commit(dir, 'feat: add the destination slice');
      git(dir, 'branch', '-f', 'base', 'HEAD');
      fs.mkdirSync(path.join(dir, 'src/features/dest'), { recursive: true });
      git(dir, 'mv', 'src/features/example/note-form.tsx', 'src/features/dest/note-form.tsx');
      commit(dir, 'refactor: move the form to the destination slice');

      const { changes } = collectChanges(dir, 'base');

      expect(changes).toStrictEqual([
        { path: 'src/features/example/note-form.tsx', deleted: false },
        { path: 'src/features/dest/note-form.tsx', deleted: false },
      ]);

      // --name-only printed the destination only, so the source slice lost
      // behavior with its spec never inspected.
      expect(
        inspect(dir, groupByModule(changes), false).map((problem) => problem.file),
      ).toStrictEqual(['src/features/dest/spec.md', 'src/features/example/spec.md']);
    });

    it('carries a deletion through instead of filtering it out', () => {
      const dir = seededRepo();
      git(dir, 'rm', '-q', 'src/features/example/spec.md');
      commit(dir, 'chore: drop the spec');

      expect(collectChanges(dir, 'base').changes).toStrictEqual([
        { path: 'src/features/example/spec.md', deleted: true },
      ]);
    });

    it('prefers the staged set when there is one', () => {
      const dir = seededRepo();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      git(dir, 'add', '-A');

      expect(collectChanges(dir, null)).toStrictEqual({
        label: 'staged changes',
        changes: [{ path: 'src/features/example/note-form.tsx', deleted: false }],
      });
    });

    it('falls back to the working tree, untracked files included', () => {
      const dir = seededRepo();
      write(dir, 'src/features/example/new-thing.ts', 'export const thing = 1;\n');

      const { label, changes } = collectChanges(dir, null);

      expect(label).toBe('working tree vs HEAD');
      expect(changes).toStrictEqual([
        { path: 'src/features/example/new-thing.ts', deleted: false },
      ]);
    });
  });

  describe(groupByModule, () => {
    it("separates a module's own documents from its code", () => {
      const modules = groupByModule([
        { path: 'src/features/example/components/note-form.tsx', deleted: false },
        { path: 'src/features/example/spec.md', deleted: false },
      ]);

      expect(modules.get('src/features/example')?.codeChanged).toBeTruthy();
      expect(modules.get('src/features/example')?.changedDocs.has('spec.md')).toBeTruthy();
    });

    it('does not call a test-only change a code change', () => {
      const modules = groupByModule([
        { path: 'src/features/example/__tests__/schema.test.ts', deleted: false },
      ]);

      expect(modules.get('src/features/example')?.codeChanged).toBeFalsy();
    });

    it('ignores files owned by no module', () => {
      expect(
        groupByModule([
          { path: 'src/lib/utils.ts', deleted: false },
          { path: 'README.md', deleted: false },
        ]).size,
      ).toBe(0);
    });

    it('records a deleted spec.md without marking the module changed', () => {
      const modules = groupByModule([{ path: 'src/features/example/spec.md', deleted: true }]);

      expect(modules.get('src/features/example')).toStrictEqual({
        changedDocs: new Set(),
        codeChanged: false,
        specDeleted: true,
      });
    });

    it('does not treat a deleted code file as a reason to inspect the module', () => {
      // Removing a feature folder removes its spec.md too; reporting that as a
      // missing spec would block every deletion.
      expect(
        groupByModule([{ path: 'src/features/example/note-form.tsx', deleted: true }]).size,
      ).toBe(0);
    });
  });

  describe(inspect, () => {
    it('flags code that moved while its spec stood still', () => {
      const root = documentedTree(true);
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/components/note-form.tsx', deleted: false }]),
        false,
      );

      expect(problems).toHaveLength(1);
      expect(problems[0]?.file).toBe('src/features/example/spec.md');
      expect(problems[0]?.message).toContain('is untouched');
    });

    it('passes when the spec moved with the code', () => {
      const root = documentedTree(true);
      const problems = inspect(
        root,
        groupByModule([
          { path: 'src/features/example/components/note-form.tsx', deleted: false },
          { path: 'src/features/example/spec.md', deleted: false },
        ]),
        false,
      );

      expect(problems).toStrictEqual([]);
    });

    it('does not accept a nested spec.md in place of the slice’s own', () => {
      const root = documentedTree(true);
      const problems = inspect(
        root,
        groupByModule([
          { path: 'src/features/example/components/note-form.tsx', deleted: false },
          { path: 'src/features/example/server/spec.md', deleted: false },
        ]),
        false,
      );

      expect(problems).toHaveLength(1);
      expect(problems[0]?.message).toContain('is untouched');
    });

    it('passes when only tests changed', () => {
      const root = documentedTree(true);
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/__tests__/schema.test.ts', deleted: false }]),
        false,
      );

      expect(problems).toStrictEqual([]);
    });

    it('drops the freshness requirement when a commit asked to skip it', () => {
      const root = documentedTree(true);
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/components/note-form.tsx', deleted: false }]),
        true,
      );

      expect(problems).toStrictEqual([]);
    });

    it('reports a module that owes a spec it does not have, even when skipping', () => {
      // The escape hatch covers freshness only — a module with no spec at all is
      // not something a commit trailer waives.
      const root = documentedTree(false);
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/note-form.tsx', deleted: false }]),
        true,
      );

      expect(problems).toHaveLength(1);
      expect(problems[0]?.file).toBe('src/features/example/spec.md');
      expect(problems[0]?.message).toContain('has no spec.md');
    });

    it('reports a spec.md deleted out from under a module that is still there', () => {
      // The one-commit bypass: remove the artifact the check protects and, with
      // deletions filtered out, nothing ever inspects the module again.
      const root = documentedTree(false);
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/spec.md', deleted: true }]),
        true,
      );

      expect(problems).toHaveLength(1);
      expect(problems[0]?.file).toBe('src/features/example/spec.md');
      expect(problems[0]?.message).toContain('was deleted but');
    });

    it('says nothing when the whole module went with its spec', () => {
      const root = tempDir('check-specs-empty-');
      const problems = inspect(
        root,
        groupByModule([{ path: 'src/features/example/spec.md', deleted: true }]),
        false,
      );

      expect(problems).toStrictEqual([]);
    });
  });

  describe('the checker as CI runs it', () => {
    it('fails on drift even when a body paragraph mentions the trailer', () => {
      const dir = repoWithChecker();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      commit(
        dir,
        'feat: change the form\n\nThe hatch is written Spec-Skip: <reason> and goes at the end.\n\nThis paragraph is not it.',
      );

      const { status, output } = runChecker(dir, '--base', 'base');

      expect(status).toBe(1);
      expect(output).toContain('src/features/example/spec.md is untouched');
    });

    it('passes when a real trailer waives freshness, and names the reason', () => {
      const dir = repoWithChecker();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      commit(dir, 'refactor: inline a constant\n\nSpec-Skip: no observable behavior change');

      const { status, output } = runChecker(dir, '--base', 'base');

      expect(status).toBe(0);
      expect(output).toContain('Spec-Skip: no observable behavior change');
    });

    it('ignores a committed trailer when inspecting uncommitted work', () => {
      const dir = repoWithChecker();
      commit(dir, 'refactor: an internal change\n\nSpec-Skip: this commit really was internal');
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');

      const { status, output } = runChecker(dir);

      expect(status).toBe(1);
      expect(output).toContain('src/features/example/spec.md is untouched');
    });

    it('says in local mode that a trailer would not be honoured', () => {
      const dir = repoWithChecker();
      write(dir, 'src/features/example/note-form.tsx', 'export const version = 2;\n');
      write(dir, 'src/features/example/spec.md', '# example\n\nShows a versioned note form.\n');

      const { status, output } = runChecker(dir);

      expect(status).toBe(0);
      expect(output).toContain('not honoured here');
    });

    it('fails when a spec.md is deleted on its own', () => {
      const dir = repoWithChecker();
      git(dir, 'rm', '-q', 'src/features/example/spec.md');
      commit(dir, 'chore: remove the spec');

      const { status, output } = runChecker(dir, '--base', 'base');

      expect(status).toBe(1);
      expect(output).toContain('was deleted but');
    });

    it('allows deleting a whole slice, spec included', () => {
      const dir = repoWithChecker();
      git(dir, 'rm', '-q', '-r', 'src/features/example');
      commit(dir, 'chore: remove the example slice');

      expect(runChecker(dir, '--base', 'base').status).toBe(0);
    });

    it('rejects a bad argument with a message rather than a stack trace', () => {
      const { status, output } = runChecker(repoWithChecker(), '--since', 'base');

      expect(status).toBe(1);
      expect(output).toContain('Unknown argument: --since');
    });
  });
});
