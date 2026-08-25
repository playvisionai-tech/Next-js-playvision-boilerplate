#!/usr/bin/env node
/**
 * Spec drift check.
 *
 * Enforces `agents/rules/docs-keep-spec-current.md`: every feature slice, lib
 * module and the UI kit carries a `spec.md`, and a change to a module's code
 * rewrites that spec in the same change. `scripts/spec-modules.js` owns the
 * module map; this script only applies it.
 *
 * It fails when a changed module either
 *   - is missing a document it owes,
 *   - had code change without its `spec.md` changing in the same set, or
 *   - had its `spec.md` deleted while the module itself stayed.
 *
 * Only CHANGED modules are inspected, so this is a ratchet: modules that have
 * no spec today are reported the first time someone touches them, not on every
 * unrelated pull request.
 *
 * What it cannot do: judge whether the spec was rewritten *well*. It sees that
 * the file changed, not that it became true. It is a prompt to the author and a
 * flag for the reviewer, not a proof of accuracy.
 *
 * Escape hatch: AGENTS.md is explicit that some changes really are internal.
 * Put a `Spec-Skip: <reason>` trailer on a commit to drop the freshness
 * requirement for the inspected range. Two limits are deliberate:
 *   - It is a trailer, so only the block at the end of a commit message counts.
 *     Prose that mentions the token — including this paragraph's counterpart in
 *     the rule doc — cannot switch the check off.
 *   - It is honoured in `--base` mode ONLY. Local mode inspects uncommitted
 *     work, whose changes no existing commit message describes, so a skip there
 *     would waive edits it was never written about.
 *
 * Usage:
 *   node scripts/check-specs.js               # staged changes, falling back to
 *                                             # the working tree vs HEAD
 *   node scripts/check-specs.js --base <ref>  # everything changed since <ref>
 *                                             # (used by CI on pull requests)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { getModuleDir, isModuleDoc, isTestFile, requiredDocs, SPEC_FILE } from './spec-modules.js';

/**
 * The escape hatch is a git trailer key, not a token searched for in the whole
 * message. An earlier version scanned message bodies for `[skip-spec]`, so the
 * very commit that documented the hatch contained the token and waived the
 * check for its own range.
 */
const SKIP_TRAILER = 'Spec-Skip';

/**
 * One file a change touched.
 *
 * @typedef {object} Change
 * @property {string} path Repo-relative path, forward-slashed or not.
 * @property {boolean} deleted Whether this change removed the file.
 */

/**
 * What one module's changes amount to.
 *
 * @typedef {object} ModuleChanges
 * @property {Set<string>} changedDocs Basenames of the module's own top-level documents that changed.
 * @property {boolean} codeChanged Whether anything that is not a document or a test changed.
 * @property {boolean} specDeleted Whether the module's own spec.md was removed.
 */

/**
 * A single reported failure.
 *
 * @typedef {object} Problem
 * @property {string} file Repo-relative path to annotate in CI.
 * @property {string} message What went wrong, and what to do about it.
 */

/**
 * @param {string[]} argv Command-line arguments, without the node and script entries.
 * @returns {{ base: string | null }} The parsed base ref, or null for local mode.
 */
export function parseArgs(argv) {
  /** @type {string | null} */
  let base = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--base') {
      i += 1;
      base = argv[i] ?? '';
    } else if (arg?.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  // A swallowed flag — `--base --oops` — would otherwise become a ref name, and
  // git's complaint lands far away from the typo that produced it.
  if (base !== null && (base === '' || base.startsWith('-'))) {
    throw new Error('--base requires a git ref');
  }

  return { base };
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
 * The reasons commits in the inspected range gave for waiving the freshness
 * rule.
 *
 * Read through git's own trailer parser (`%(trailers:key=…)`, the same parse
 * `git interpret-trailers --parse` performs), so a line only counts when it
 * sits in the trailer block at the end of a message. A reason is mandatory:
 * `Spec-Skip:` with nothing after it waives nothing, because a skip a reviewer
 * cannot question is the silent default this hatch exists to avoid.
 *
 * @param {string} root Repository root.
 * @param {string | null} base Base ref for the inspected range, or null for local mode.
 * @returns {string[]} One non-empty reason per honoured trailer, newest commit first.
 */
export function collectSkipRequests(root, base) {
  // Local mode inspects uncommitted work. No commit message in the repository
  // describes it, so honouring a trailer here means one old commit silently
  // waives every unrelated change made after it.
  if (!base) {
    return [];
  }

  try {
    // Two dots, not three. `git diff base...HEAD` is merge-base, so a
    // three-dot log reads commits this check never inspects: once a skip commit
    // lands on the base branch, every branch forked before it would inherit the
    // waiver.
    return git(
      ['log', `--format=%(trailers:key=${SKIP_TRAILER},valueonly,separator=%x0A)`, `${base}..HEAD`],
      root,
    )
      .flatMap((record) => record.split('\n'))
      .map((reason) => reason.trim())
      .filter(Boolean);
  } catch {
    // A shallow clone or an unknown base is not a reason to fail the build on
    // something this check is only using as a hint.
    return [];
  }
}

/**
 * Turn `--name-status -z` output into the paths a change actually touched.
 *
 * @param {string[]} fields NUL-split git fields: a status letter, then one path, or `R…`/`C…` then two.
 * @returns {Change[]} One entry per touched path.
 */
function parseNameStatus(fields) {
  /** @type {Change[]} */
  const changes = [];
  let i = 0;

  while (i < fields.length) {
    const status = fields[i] ?? '';
    i += 1;

    if (status.startsWith('R') || status.startsWith('C')) {
      const from = fields[i];
      const to = fields[i + 1];
      i += 2;

      // `--name-only` prints only the destination of a rename, so moving a file
      // out of a module took behavior with it while that module's spec was
      // never inspected. A copy leaves its source alone, so only a rename
      // counts both ends.
      if (from && status.startsWith('R')) {
        changes.push({ path: from, deleted: false });
      }

      if (to) {
        changes.push({ path: to, deleted: false });
      }

      continue;
    }

    const file = fields[i];
    i += 1;

    if (file) {
      changes.push({ path: file, deleted: status.startsWith('D') });
    }
  }

  return changes;
}

/**
 * Collect the changes to inspect.
 *
 * Deletions are carried rather than filtered out. `groupByModule` decides which
 * of them matter; dropping them here is what made a lone `spec.md` deletion
 * invisible.
 *
 * @param {string} root Repository root.
 * @param {string | null} base Base ref to diff against, or null for local mode.
 * @returns {{ label: string, changes: Change[] }} How the set was chosen, and what changed.
 */
export function collectChanges(root, base) {
  if (base) {
    return {
      label: `changes since ${base}`,
      changes: parseNameStatus(git(['diff', '-z', '--name-status', '-M', `${base}...HEAD`], root)),
    };
  }

  // Decide the mode on the unfiltered staged set, so a commit that only stages
  // deletions is still treated as "staged" rather than falling through to an
  // unrelated dirty working tree.
  if (git(['diff', '--cached', '-z', '--name-only'], root).length > 0) {
    return {
      label: 'staged changes',
      changes: parseNameStatus(git(['diff', '--cached', '-z', '--name-status', '-M'], root)),
    };
  }

  // Nothing staged: fall back to the working tree, so running the check before
  // staging is not a silent no-op that reports success.
  return {
    label: 'working tree vs HEAD',
    changes: [
      ...parseNameStatus(git(['diff', '-z', '--name-status', '-M', 'HEAD'], root)),
      ...git(['ls-files', '-z', '--others', '--exclude-standard'], root).map((file) => ({
        path: file,
        deleted: false,
      })),
    ],
  };
}

/**
 * Fetch or create the entry for a module.
 *
 * @param {Map<string, ModuleChanges>} modules Grouped changes so far.
 * @param {string} mod Module directory.
 * @returns {ModuleChanges} The module's entry, created empty if it had none.
 */
function entryFor(modules, mod) {
  let entry = modules.get(mod);

  if (!entry) {
    entry = { changedDocs: new Set(), codeChanged: false, specDeleted: false };
    modules.set(mod, entry);
  }

  return entry;
}

/**
 * Group the changes by owning module, splitting each module's changes into its
 * own documents and everything else.
 *
 * @param {Change[]} changes Repo-relative changes.
 * @returns {Map<string, ModuleChanges>} One entry per touched module.
 */
export function groupByModule(changes) {
  /** @type {Map<string, ModuleChanges>} */
  const modules = new Map();

  for (const change of changes) {
    const file = change.path.replaceAll('\\', '/');
    const mod = getModuleDir(file);

    if (!mod) {
      continue;
    }

    const ownDoc = isModuleDoc(file);

    if (change.deleted) {
      // Deletions do not otherwise mark a module changed: removing a feature
      // folder removes its spec.md too, and reporting that as a missing spec
      // would block every removal. The exception is a spec.md deleted on its
      // own — without it, one commit can drop the artifact this check exists to
      // protect and no module is ever inspected for it.
      if (ownDoc && file === `${mod}/${SPEC_FILE}`) {
        entryFor(modules, mod).specDeleted = true;
      }

      continue;
    }

    const entry = entryFor(modules, mod);

    if (ownDoc) {
      entry.changedDocs.add(path.posix.basename(file));
    } else if (!isTestFile(file)) {
      entry.codeChanged = true;
    }
  }

  return modules;
}

/**
 * Apply the rule to the grouped changes.
 *
 * @param {string} root Repository root, used to test for the documents on disk.
 * @param {Map<string, ModuleChanges>} modules Grouped changes.
 * @param {boolean} skipFreshness Whether a commit asked to waive the freshness rule.
 * @returns {Problem[]} One entry per problem, in reporting order.
 */
export function inspect(root, modules, skipFreshness) {
  /** @type {Problem[]} */
  const problems = [];

  // Annotated: the type-aware lint pass loses the element type through
  // toSorted() and then treats every use of `mod` as an unsafe argument.
  /** @type {string[]} */
  const inspectionOrder = [...modules.keys()].toSorted();

  for (const mod of inspectionOrder) {
    const entry = modules.get(mod);

    if (!entry) {
      continue;
    }

    const { changedDocs, codeChanged, specDeleted } = entry;

    // The module is no longer on disk — deleted outright, or renamed away
    // wholesale. Demanding a spec from it would block every removal.
    if (!fs.existsSync(path.join(root, mod))) {
      continue;
    }

    if (specDeleted) {
      problems.push({
        file: `${mod}/${SPEC_FILE}`,
        message: `${mod}/${SPEC_FILE} was deleted but ${mod} is still here — restore it, or remove the module along with it`,
      });

      // The missing-document check below would only restate this in vaguer
      // words, and "has no spec.md" reads like a module that never had one.
      continue;
    }

    for (const doc of requiredDocs()) {
      if (!fs.existsSync(path.join(root, mod, doc.name))) {
        problems.push({
          file: `${mod}/${doc.name}`,
          message: `${mod} changed but has no ${doc.name} — ${doc.why}`,
        });
      }
    }

    // Drift: code moved, the spec did not. Only meaningful once the spec
    // exists — otherwise the missing-file problem above already said it.
    const specExists = fs.existsSync(path.join(root, mod, SPEC_FILE));

    if (codeChanged && specExists && !changedDocs.has(SPEC_FILE) && !skipFreshness) {
      problems.push({
        file: `${mod}/${SPEC_FILE}`,
        message: `${mod} has code changes but ${mod}/${SPEC_FILE} is untouched — rewrite it to describe the new behavior, or put a "${SKIP_TRAILER}: <reason>" trailer on a commit if nothing observable changed`,
      });
    }
  }

  return problems;
}

/**
 * What to append to the success line about the escape hatch.
 *
 * @param {string | null} base Base ref for the inspected range, or null for local mode.
 * @param {string[]} reasons Skip reasons found in the range.
 * @returns {string} A trailing note, or the empty string when there is nothing to say.
 */
function skipNote(base, reasons) {
  if (!base) {
    return ` (local mode: a ${SKIP_TRAILER} trailer is not honoured here — it would waive changes no commit message describes)`;
  }

  if (reasons.length === 0) {
    return '';
  }

  return ` (${SKIP_TRAILER}: ${reasons.join('; ')} — freshness not required)`;
}

function main() {
  const { base } = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const { label, changes } = collectChanges(root, base);
  const modules = groupByModule(changes);
  const skipReasons = collectSkipRequests(root, base);
  const problems = inspect(root, modules, skipReasons.length > 0);

  if (problems.length > 0) {
    console.error(`check-specs: ${problems.length} problem(s) in ${label}\n`);

    for (const problem of problems) {
      console.error(`  ✖ ${problem.message}`);

      if (process.env.GITHUB_ACTIONS === 'true') {
        console.error(`::error file=${problem.file}::${problem.message}`);
      }
    }

    console.error('\nSee agents/rules/docs-keep-spec-current.md for what a spec owes.');
    process.exit(1);
  }

  console.log(
    `check-specs: ${modules.size} module(s) checked in ${label} — specs present and in sync.${skipNote(base, skipReasons)}`,
  );
}

// Only run when invoked as a script, so the tests can import the pieces above.
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(`check-specs: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
