import { beforeEach, describe, expect, it, vi } from 'vitest';

type StubApp = { name: string };

const CONFIGURED = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:0:web:0',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-TEST',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
};

let env: Record<string, string | undefined> = { ...CONFIGURED };

const initializeApp = vi.fn<(options: Record<string, unknown>) => StubApp>(() => ({
  name: 'created',
}));
const getApps = vi.fn<() => StubApp[]>(() => []);

// Mocked by path rather than by `import()`. The typed overload requires the
// factory to be structurally assignable to the whole module, which would mean
// fabricating a fake `FirebaseApp` purely to satisfy the compiler.
// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('firebase/app', () => ({ getApps, initializeApp }));

// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('@/lib/env', () => ({ Env: new Proxy({}, { get: (_, key) => env[String(key)] }) }));

/**
 * The configured gate is computed once at module load, so each test needs a
 * fresh copy evaluated against the environment it just set.
 *
 * @returns A freshly evaluated copy of the module under test.
 */
async function loadApp() {
  vi.resetModules();

  return await import('../app');
}

describe('Firebase app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = { ...CONFIGURED };
    getApps.mockReturnValue([]);
  });

  it('initializes with exactly the four configured values', async () => {
    const { getFirebaseApp } = await loadApp();

    expect(getFirebaseApp()).toStrictEqual({ name: 'created' });
    expect(initializeApp).toHaveBeenCalledExactlyOnceWith({
      apiKey: 'test-api-key',
      appId: '1:0:web:0',
      measurementId: 'G-TEST',
      projectId: 'test-project',
    });
  });

  it('reuses an app that already exists, so hot reload does not throw', async () => {
    getApps.mockReturnValue([{ name: 'existing' }]);

    const { getFirebaseApp } = await loadApp();

    expect(getFirebaseApp()).toStrictEqual({ name: 'existing' });
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it.each(Object.keys(CONFIGURED))('is unconfigured when %s is missing', async (missing) => {
    env = { ...CONFIGURED, [missing]: undefined };

    const { getFirebaseApp } = await loadApp();

    expect(getFirebaseApp()).toBeNull();
    expect(initializeApp).not.toHaveBeenCalled();
  });

  // This is the state of a fresh checkout: `.env` ships the keys blank, so the
  // gate has to treat empty exactly as it treats absent.
  it.each(Object.keys(CONFIGURED))('is unconfigured when %s is blank', async (blank) => {
    env = { ...CONFIGURED, [blank]: '' };

    const { getFirebaseApp } = await loadApp();

    expect(getFirebaseApp()).toBeNull();
    expect(initializeApp).not.toHaveBeenCalled();
  });
});
