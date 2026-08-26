import { beforeEach, describe, expect, it, vi } from 'vitest';

type StubAnalytics = { app: string };

const getAnalytics = vi.fn<() => StubAnalytics>(() => ({ app: 'stub' }));
// No implementation: `beforeEach` sets the resolved value for every test.
const isSupported = vi.fn<() => Promise<boolean>>();
const logEvent = vi.fn<(analytics: StubAnalytics, name: string, params?: unknown) => void>();
const setConsent = vi.fn<(consent: Record<string, string>) => void>();
const setUserId = vi.fn<(analytics: StubAnalytics, userId: string | null) => void>();

// Mocked by path rather than by `import()`. The typed overload requires the
// factory to be structurally assignable to the whole module, which would mean
// fabricating a fake `Analytics` and `FirebaseApp` purely to satisfy the
// compiler. A partial mock of the three functions actually used is the clearer
// test; `check:types` still covers everything else in this file.
// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('firebase/analytics', () => ({
  getAnalytics,
  isSupported,
  logEvent,
  setConsent,
  setUserId,
}));

let firebaseApp: { name: string } | null = { name: 'stub-app' };

// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('../app', () => ({ getFirebaseApp: () => firebaseApp }));

/**
 * The module keeps its Analytics handle at module scope, so each test needs a
 * fresh copy rather than whatever the previous one left behind.
 *
 * @returns A freshly evaluated copy of the module under test.
 */
async function loadAnalytics() {
  vi.resetModules();

  return await import('../analytics');
}

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseApp = { name: 'stub-app' };
    isSupported.mockResolvedValue(true);
  });

  it('denies storage consent before Analytics is started', async () => {
    const { initAnalytics } = await loadAnalytics();

    await initAnalytics();

    expect(setConsent).toHaveBeenCalledWith(
      expect.objectContaining({ ad_storage: 'denied', analytics_storage: 'denied' }),
    );

    // Order is the whole point: called afterwards it is only an update, and a
    // cookie would already have been written.
    const consentAt = setConsent.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const startedAt = getAnalytics.mock.invocationCallOrder[0] ?? 0;

    expect(consentAt).toBeLessThan(startedAt);
  });

  it('does not start Analytics when the browser is unsupported', async () => {
    isSupported.mockResolvedValue(false);

    const { initAnalytics, track } = await loadAnalytics();

    await initAnalytics();
    track('anything');

    expect(getAnalytics).not.toHaveBeenCalled();
    expect(setConsent).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not reach the SDK at all when Firebase is unconfigured', async () => {
    firebaseApp = null;

    const { initAnalytics, track } = await loadAnalytics();

    await initAnalytics();
    track('anything');

    expect(isSupported).not.toHaveBeenCalled();
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('drops events recorded before it has started', async () => {
    const { track } = await loadAnalytics();

    track('too_early', { a: 1 });

    expect(logEvent).not.toHaveBeenCalled();
  });

  it('forwards a recorded event once it has started', async () => {
    const { initAnalytics, track } = await loadAnalytics();

    await initAnalytics();
    track('note_added', { length: 12 });

    expect(logEvent).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'note_added', {
      length: 12,
    });
  });

  it('associates and clears the user', async () => {
    const { identify, initAnalytics } = await loadAnalytics();

    await initAnalytics();
    identify('user_123');
    identify(null);

    expect(setUserId).toHaveBeenNthCalledWith(1, expect.anything(), 'user_123');
    expect(setUserId).toHaveBeenNthCalledWith(2, expect.anything(), null);
  });

  it('grants consent only when asked to', async () => {
    const { grantAnalyticsConsent, initAnalytics } = await loadAnalytics();

    await initAnalytics();

    expect(setConsent).not.toHaveBeenCalledWith(
      expect.objectContaining({ analytics_storage: 'granted' }),
    );

    grantAnalyticsConsent();

    expect(setConsent).toHaveBeenLastCalledWith({ analytics_storage: 'granted' });
  });
});
