#!/usr/bin/env node
/**
 * Relative markdown link check.
 *
 * Every tracked `.md` file is scanned for markdown link destinations —
 * `[text](target)`, and the image form `![alt](target)`, which is the same
 * syntax and the same promise to the reader. A destination that names a path
 * inside the repository must resolve to something on disk — a directory counts,
 * because a forge renders a link to one perfectly well. A link into
 * `public/assets/images/` that was never there renders as a broken image in the
 * README and tells a new reader the project is unmaintained before they have
 * read a line of it.
 *
 * A destination is checked when it is a path. These are skipped:
 *   - `http://`, `https://` and `mailto:` — off-machine, and reaching the
 *     network would make the check slow, flaky, and dependent on someone
 *     else's uptime.
 *   - anchor-only (`#section`) — a link within the page, not to a file.
 *   - empty (`[text]()`) — there is no path to resolve.
 * Everything else is resolved relative to the directory of the file the link
 * is written in, after a `#fragment` is stripped and `%20`-style escapes are
 * decoded. A leading `/` means repository root, the way a forge renders it.
 *
 * Scope is deliberately this narrow. Two things it does NOT do:
 *
 *   - It does not check paths in backticks. This was measured on this
 *     repository: flagging backticked paths surfaces 58 items, of which about
 *     4 are real. Prose legitimately uses relative shorthand — `server/`,
 *     `components/ui`, `features/a` — that resolves from wherever the reader
 *     is standing rather than from the file naming it, and it names packages
 *     and commands that are not paths at all. Making that pass would take an
 *     ignore list longer than this script, and an ignore list that long stops
 *     being read and starts being appended to. Do not rebuild it.
 *   - It does not check anchors. `other.md#missing-heading` is verified as far
 *     as `other.md`; whether that heading exists is not inspected.
 *
 * Also skipped: fenced code blocks. Link syntax inside ``` or ~~~ is an
 * example of markdown, not a link a reader can follow.
 *
 * There is no escape hatch, and that is the design. A link is a promise that
 * something is there; if a document wants to name a file that intentionally
 * does not exist yet, the fix is to stop using link syntax for it — backticks
 * say "this is a path" without claiming it resolves.
 *
 * Only tracked files are scanned (`git ls-files`), so a scratch note or an
 * ignored build artifact never fails the build.
 *
 * Usage:
 *   node scripts/check-links.js
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Destination prefixes that point off this machine, and so are not ours to verify. */
const EXTERNAL_PREFIXES = ['http://', 'https://', 'mailto:'];

/**
 * One markdown link destination, and where it was written.
 *
 * @typedef {object} Link
 * @property {string} target The raw destination, exactly as written.
 * @property {number} line 1-based line number of the line holding the destination.
 */

/**
 * A single reported failure.
 *
 * @typedef {object} Problem
 * @property {string} file Repo-relative path to annotate in CI.
 * @property {number} line 1-based line number to annotate in CI.
 * @property {string} target The destination as written.
 * @property {string} message What went wrong, and what to do about it.
 */

/**
 * Matches the destination part of a markdown link: the `](…)` that follows the
 * text or the alt text.
 *
 * Anchored on `](` rather than on the whole `[text](target)` form so that the
 * nested case still yields both destinations. `[![alt](img.png)](page.md)` is
 * how every badge and screenshot in a README is written; a pattern that
 * requires a bracket group with no `]` inside it matches the inner image and
 * walks straight past `page.md`.
 *
 * The destination is either `<bracketed>` (which may contain spaces) or a run
 * of non-space characters, optionally followed by a quoted title.
 */
const LINK_DESTINATION = /\]\(\s*(<[^>\n]*>|[^\s)]*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/gu;

/** Opens or closes a fenced code block: three or more backticks or tildes. */
const CODE_FENCE = /^\s{0,3}(?:`{3,}|~{3,})/u;

/**
 * Every markdown link destination in a document, in reading order.
 *
 * @param {string} text The full contents of a markdown file.
 * @returns {Link[]} One entry per destination found outside a fenced code block.
 */
export function parseLinks(text) {
  /** @type {Link[]} */
  const links = [];
  let inFence = false;

  const lines = text.split('\n');

  for (const [index, line] of lines.entries()) {
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    for (const match of line.matchAll(LINK_DESTINATION)) {
      const raw = match[1] ?? '';
      // <angle brackets> are a wrapper, not part of the path.
      const target = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;

      links.push({ target, line: index + 1 });
    }
  }

  return links;
}

/**
 * Is this destination one this check is responsible for?
 *
 * @param {string} target The destination as written.
 * @returns {boolean} True when it names a path inside the repository.
 */
export function isLocalPath(target) {
  const trimmed = target.trim();

  if (trimmed === '' || trimmed.startsWith('#')) {
    return false;
  }

  return !EXTERNAL_PREFIXES.some((prefix) => trimmed.toLowerCase().startsWith(prefix));
}

/**
 * Turn a destination into the absolute path it claims exists.
 *
 * @param {string} root Repository root, for root-relative destinations.
 * @param {string} file Repo-relative path of the file the link is written in.
 * @param {string} target The destination as written.
 * @returns {string | null} The absolute path, or null when the destination has
 *   no path part at all — `page.md#section` has one, `#section` does not.
 */
function resolveTarget(root, file, target) {
  // Everything from the first `#` is an anchor within the destination
  // document. What is checked is that the document is there.
  const withoutFragment = target.trim().split('#')[0] ?? '';

  if (withoutFragment === '') {
    return null;
  }

  let decoded = withoutFragment;

  try {
    // A path written `my%20file.md` is a real, resolvable file. Percent
    // escapes that are not valid UTF-8 throw; the raw text is the better guess
    // then, and it will simply fail to resolve if it was nonsense.
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }

  if (decoded.startsWith('/')) {
    return path.join(root, decoded);
  }

  return path.resolve(root, path.dirname(file), decoded);
}

/**
 * Apply the rule to one document.
 *
 * @param {string} root Repository root, used to resolve and to test on disk.
 * @param {string} file Repo-relative path of the document.
 * @param {string} text Its contents.
 * @returns {{ checked: number, problems: Problem[] }} How many destinations
 *   were this check's responsibility, and which of them did not resolve.
 */
export function checkMarkdown(root, file, text) {
  /** @type {Problem[]} */
  const problems = [];
  let checked = 0;

  for (const link of parseLinks(text)) {
    if (!isLocalPath(link.target)) {
      continue;
    }

    const resolved = resolveTarget(root, file, link.target);

    if (resolved === null) {
      continue;
    }

    checked += 1;

    if (!fs.existsSync(resolved)) {
      problems.push({
        file,
        line: link.line,
        target: link.target,
        message: `${file}:${link.line} links to ${link.target}, which does not exist — fix the path, add the file, or stop using link syntax for something that is not there`,
      });
    }
  }

  return { checked, problems };
}

/**
 * @param {string[]} args Arguments to pass to git.
 * @param {string} [cwd] Directory to run git in.
 * @returns {string[]} NUL-separated git output, split and emptied of blanks.
 */
function git(args, cwd) {
  // core.quotepath=false with -z keeps non-ASCII paths and paths with spaces
  // readable instead of C-quoted.
  const out = execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return out.split('\0').filter(Boolean);
}

/** @returns {string} The absolute path to the repository root. */
function repoRoot() {
  return git(['rev-parse', '--show-toplevel'], import.meta.dirname)[0]?.trim() ?? '';
}

/**
 * The markdown files to scan.
 *
 * Tracked files only. Scanning the working tree instead would fail the build on
 * a developer's untracked scratch notes, and on whatever a build step dropped
 * into an ignored directory.
 *
 * @param {string} root Repository root.
 * @returns {string[]} Repo-relative paths, forward-slashed.
 */
export function listMarkdownFiles(root) {
  return git(['ls-files', '-z', '--', '*.md'], root).map((file) => file.replaceAll('\\', '/'));
}

function main() {
  const root = repoRoot();
  const files = listMarkdownFiles(root);
  /** @type {Problem[]} */
  const problems = [];
  let checked = 0;

  for (const file of files) {
    const full = path.join(root, file);

    // A tracked path that is not on disk is a half-applied checkout or a
    // deleted-but-unstaged file. Neither is this check's business to report.
    if (!fs.existsSync(full)) {
      continue;
    }

    const result = checkMarkdown(root, file, fs.readFileSync(full, 'utf-8'));
    checked += result.checked;
    problems.push(...result.problems);
  }

  if (problems.length > 0) {
    console.error(`check-links: ${problems.length} broken link(s) in ${files.length} file(s)\n`);

    for (const problem of problems) {
      console.error(`  ✖ ${problem.message}`);

      if (process.env.GITHUB_ACTIONS === 'true') {
        console.error(`::error file=${problem.file},line=${problem.line}::${problem.message}`);
      }
    }

    console.error(
      '\nExternal URLs and anchors are not checked. See the header of scripts/check-links.js for why the scope stops there.',
    );
    process.exit(1);
  }

  console.log(
    `check-links: ${checked} relative link(s) across ${files.length} markdown file(s) — all resolve.`,
  );
}

// Only run when invoked as a script, so the tests can import the pieces above.
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(`check-links: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
