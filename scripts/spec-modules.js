/**
 * What the spec system considers a "module", and which documents each module
 * owes.
 *
 * This file is the single source of truth for the rule. `check-specs.js` only
 * applies the map — keeping the two apart is what stops a second enforcer from
 * growing its own divergent copy later.
 *
 * The map follows AGENTS.md rather than the directory listing: a feature slice
 * and a lib module are modules, `src/app/` is not. Routes hold no behavior of
 * their own here ("Routing concerns ONLY"), so there is nothing for a route
 * segment to describe that its feature's spec does not already own.
 */

const SPEC_FILE = 'spec.md';
const DECISIONS_FILE = 'decisions.md';

/**
 * `src/components/ui` is ONE module. Individual primitives do not get their own
 * spec — the inventory at `src/components/ui/spec.md` covers all of them, which
 * is why that file lists a row per component including the server-safe column.
 */
const UI_MODULE = 'src/components/ui';

/** These are namespaces: each direct subdirectory is a module of its own. */
const MODULE_PARENTS = ['src/features/', 'src/lib/'];

/**
 * Directory names under a namespace that are infrastructure rather than a
 * module. `src/lib/__tests__/` holds tests for loose files sitting directly in
 * `src/lib/`; it owes no spec.
 */
const NON_MODULE_DIRS = new Set(['__tests__']);

/**
 * A document a module must carry, and the reason to give when it is missing.
 *
 * @typedef {object} RequiredDoc
 * @property {string} name Filename the module must carry at its top level.
 * @property {string} why What the author is being asked to write, phrased for the error message.
 */

/**
 * Normalise a path to forward slashes so Windows checkouts and git's own output
 * compare the same way.
 *
 * @param {string} file Repo-relative path, in either slash style.
 * @returns {string} The same path with forward slashes.
 */
function toPosix(file) {
  return file.replaceAll('\\', '/');
}

/**
 * Map a repo-relative file path to the module directory that owns it.
 *
 * @param {string} file Repo-relative path, in either slash style.
 * @returns {string | null} The owning module directory, or null when the file
 *   belongs to no module — notably loose files directly inside
 *   `src/features/` or `src/lib/`, which are not modules themselves.
 */
export function getModuleDir(file) {
  const p = toPosix(file);

  if (p.startsWith(`${UI_MODULE}/`)) {
    return UI_MODULE;
  }

  for (const base of MODULE_PARENTS) {
    if (!p.startsWith(base)) {
      continue;
    }

    const rest = p.slice(base.length);
    const slash = rest.indexOf('/');

    // No slash left => a loose file directly inside the namespace.
    if (slash <= 0) {
      return null;
    }

    const moduleName = rest.slice(0, slash);

    if (NON_MODULE_DIRS.has(moduleName)) {
      return null;
    }

    return base + moduleName;
  }

  return null;
}

/**
 * The documents a module must carry.
 *
 * `spec.md` only. AGENTS.md makes `decisions.md` conditional — "append to
 * decisions.md only if a real fork in the road was taken" — so requiring one
 * per module would manufacture exactly the padding the docs rule warns about,
 * and would turn every module without a genuine trade-off into a file of
 * invented ones. The reason travels with the requirement so a document can
 * never be demanded without the error saying what to write in it.
 *
 * @returns {RequiredDoc[]} Required documents, in reporting order.
 */
export function requiredDocs() {
  return [{ name: SPEC_FILE, why: 'describe what the module does today' }];
}

/**
 * Is this changed file one of the module's OWN top-level documents?
 *
 * Matching `spec.md` by basename anywhere under the module let a nested file
 * such as `features/x/server/spec.md` stand in for the slice's own spec, so a
 * behavior change could be signed off by a document that describes something
 * else. Only the file the rule actually names counts.
 *
 * @param {string} file Repo-relative path.
 * @returns {boolean} True for the module's own spec.md or decisions.md.
 */
export function isModuleDoc(file) {
  const p = toPosix(file);
  const mod = getModuleDir(p);

  if (!mod) {
    return false;
  }

  return p === `${mod}/${SPEC_FILE}` || p === `${mod}/${DECISIONS_FILE}`;
}

/**
 * Is this a test rather than the code under test?
 *
 * The drift rule asks for a spec rewrite when a module's behavior changes.
 * Adding or fixing a test changes nothing a user or caller can observe, so
 * demanding a spec edit for it produces padding. Tests still count the module
 * as changed for the "spec.md exists" check — only the freshness rule skips
 * them.
 *
 * @param {string} file Repo-relative path.
 * @returns {boolean} True for a test or a story, neither of which is behavior.
 */
export function isTestFile(file) {
  const p = toPosix(file);
  return p.includes('/__tests__/') || /\.(?:test|stories)\.[jt]sx?$/u.test(p);
}

export { SPEC_FILE };
