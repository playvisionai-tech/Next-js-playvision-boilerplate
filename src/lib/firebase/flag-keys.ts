import 'client-only';

/**
 * Every flag this app knows about, and the value it takes when Remote Config
 * cannot answer.
 *
 * This module imports no SDK on purpose — it is plain data, read by `flags.ts`,
 * by the provider, and by tests. It is still `client-only`, because flags are
 * evaluated in the browser and nothing on the server reads their values; see
 * `decisions.md`. Types are erased, so `import type { FlagKey }` stays usable
 * from anywhere.
 *
 * **The default is the contract.** Remote Config is unreachable during server
 * rendering, on a first paint before the fetch resolves, offline, behind a
 * blocked origin, and in any checkout with no Firebase project. Every one of
 * those renders the default, so a default that is not the safe value is a
 * production incident waiting for a network blip.
 *
 * Nothing reads a flag yet. The first feature that needs one is where a call
 * site earns its place — the same rule `src/components/ui/spec.md` applies to
 * primitives.
 */
export const FLAG_DEFAULTS = {
  /**
   * Reference flag. It exists so the wiring has a subject and the tests have
   * something to resolve; delete it once a real flag replaces it.
   */
  example_reference_flag: false,
} satisfies Record<string, boolean>;

/** The names `getFlag` accepts. An unknown name is a type error. */
export type FlagKey = keyof typeof FLAG_DEFAULTS;

/**
 * Every key of `FLAG_DEFAULTS`, listed rather than derived.
 *
 * `Object.keys` returns `string[]`, so deriving this needs a cast that asserts
 * something the compiler cannot see. Listing them keeps every reader cast-free;
 * the test in `__tests__/flags.test.tsx` fails if this and `FLAG_DEFAULTS` ever
 * disagree, which is the drift this trades against.
 */
export const FLAG_KEYS: readonly FlagKey[] = ['example_reference_flag'];
