import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAG_DEFAULTS, FLAG_KEYS } from '../flag-keys';

type StubConfig = {
  defaultConfig: Record<string, boolean>;
  settings: { minimumFetchIntervalMillis: number };
};

/** The config object the SDK stub last handed back, so tests can inspect it. */
let lastConfig: StubConfig | null = null;

// No implementation: `beforeEach` sets the resolved value for every test.
const fetchAndActivate = vi.fn<() => Promise<boolean>>();
const getValue = vi.fn<() => { asBoolean: () => boolean }>(() => ({ asBoolean: () => true }));
const getRemoteConfig = vi.fn<() => StubConfig>(() => {
  lastConfig = { defaultConfig: {}, settings: { minimumFetchIntervalMillis: 0 } };

  return lastConfig;
});

// Mocked by path rather than by `import()`. The typed overload requires the
// factory to be structurally assignable to the whole module, which would mean
// fabricating a fake `Analytics` and `FirebaseApp` purely to satisfy the
// compiler. A partial mock of the three functions actually used is the clearer
// test; `check:types` still covers everything else in this file.
// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('firebase/remote-config', () => ({
  fetchAndActivate,
  getRemoteConfig,
  getValue,
}));

let firebaseApp: { name: string } | null = null;

// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('../app', () => ({ getFirebaseApp: () => firebaseApp }));

/**
 * Fresh module per test: `flags.ts` holds its config handle at module scope.
 *
 * @returns A freshly evaluated copy of the module under test.
 */
async function loadFlags() {
  vi.resetModules();

  return await import('../flags');
}

// The reference flag defaults to false and the stub reports true, so any
// assertion of a truthy value below proves it came from Remote Config rather
// than from the default map.
describe('Feature flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseApp = null;
    lastConfig = null;
    getValue.mockReturnValue({ asBoolean: () => true });
    fetchAndActivate.mockResolvedValue(true);
  });

  describe('with no Firebase project configured', () => {
    it('reads a flag as its declared default', async () => {
      const { getFlag } = await loadFlags();

      expect(getFlag('example_reference_flag')).toBe(FLAG_DEFAULTS.example_reference_flag);
    });

    it('never reaches the SDK', async () => {
      const { getFlag, initFlags } = await loadFlags();

      await initFlags();
      getFlag('example_reference_flag');

      expect(getRemoteConfig).not.toHaveBeenCalled();
      expect(fetchAndActivate).not.toHaveBeenCalled();
      expect(getValue).not.toHaveBeenCalled();
    });

    it('reports every declared flag, and only those', async () => {
      const { readFlags } = await loadFlags();

      expect(Object.keys(readFlags()).toSorted()).toStrictEqual(
        Object.keys(FLAG_DEFAULTS).toSorted(),
      );
    });
  });

  describe('with Remote Config active', () => {
    beforeEach(() => {
      firebaseApp = { name: 'stub-app' };
    });

    it('hands the in-repo defaults to the SDK, so a miss resolves locally', async () => {
      const { initFlags } = await loadFlags();

      await initFlags();

      expect(lastConfig?.defaultConfig).toStrictEqual({ ...FLAG_DEFAULTS });
    });

    it('sets a fetch interval rather than leaving the SDK default implicit', async () => {
      const { initFlags } = await loadFlags();

      await initFlags();

      expect(lastConfig?.settings.minimumFetchIntervalMillis).toBeGreaterThan(0);
    });

    it('returns the fetched value in preference to the default', async () => {
      const { getFlag, initFlags } = await loadFlags();

      await initFlags();

      expect(getFlag('example_reference_flag')).toBeTruthy();
      expect(FLAG_DEFAULTS.example_reference_flag).toBeFalsy();
    });

    it('reports fetched values for every flag', async () => {
      const { initFlags, readFlags } = await loadFlags();

      await initFlags();

      expect(readFlags()).toStrictEqual({ example_reference_flag: true });
    });

    // A flag service outage must not be a page outage.
    it('falls back to defaults when the fetch rejects, without throwing', async () => {
      fetchAndActivate.mockRejectedValue(new Error('offline'));
      getValue.mockReturnValue({ asBoolean: () => false });

      const { getFlag, initFlags } = await loadFlags();

      await expect(initFlags()).resolves.toBeUndefined();
      expect(getFlag('example_reference_flag')).toBe(FLAG_DEFAULTS.example_reference_flag);
    });
  });

  // FLAG_KEYS is maintained by hand so readers need no cast. This is what stops
  // it drifting from FLAG_DEFAULTS when someone adds a flag.
  it('lists exactly the keys it declares defaults for', () => {
    expect([...FLAG_KEYS].toSorted()).toStrictEqual(Object.keys(FLAG_DEFAULTS).toSorted());
  });

  it('declares a default for every flag, so no flag can resolve to undefined', () => {
    for (const value of Object.values(FLAG_DEFAULTS)) {
      expect(value).toBeTypeOf('boolean');
    }
  });
});
