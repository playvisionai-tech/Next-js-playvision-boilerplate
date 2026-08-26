import 'client-only';
import type { Analytics } from 'firebase/analytics';
import { getAnalytics, isSupported, logEvent, setConsent, setUserId } from 'firebase/analytics';
import { getFirebaseApp } from './app';

/** Values GA4 accepts as event parameters. Anything else is a mistake. */
type EventParams = Record<string, string | number | boolean>;

let analytics: Analytics | null = null;

/**
 * Starts Analytics, with storage consent denied.
 *
 * **Consent defaults to denied and this app has no way to grant it yet.** There
 * is no consent banner here, and `src/lib/config.ts` declares an `fr` locale,
 * so the `_ga` cookies GA4 would otherwise write are non-essential storage
 * requiring prior opt-in. Denied-by-default is the only posture that ships
 * honestly until a banner exists. The cost is real: GA4 models cookieless
 * pings rather than measuring them, so early numbers are directional, and
 * Remote Config's audience targeting has nothing to target on. See `spec.md`.
 *
 * `setConsent` runs before `getAnalytics` deliberately — called first it writes
 * gtag's consent *default*, called afterwards it is only an update, and the
 * difference is whether a cookie is written before the user was asked.
 *
 * `isSupported()` is not a formality. It returns false in a browser extension
 * page, when cookies are disabled, when IndexedDB is absent, and — the case
 * that actually happens — when IndexedDB is present but cannot be opened, which
 * is a Firefox private window and a locked-down Safari profile.
 *
 * @returns Resolves once Analytics is running, or immediately when it cannot.
 */
export async function initAnalytics(): Promise<void> {
  const app = getFirebaseApp();

  if (app === null) {
    return;
  }

  if (!(await isSupported())) {
    return;
  }

  setConsent({
    ad_personalization: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    analytics_storage: 'denied',
  });

  analytics = getAnalytics(app);
}

/**
 * Records one event.
 *
 * A no-op before `initAnalytics` resolves, when the browser is unsupported, and
 * in any checkout with no Firebase project. Events are dropped rather than
 * queued: the service worker's allow-list ends in `NetworkOnly`, so nothing
 * buffers them offline either. `src/lib/offline-queue` is for this app's own
 * writes and does not carry telemetry — losing an event is acceptable in a way
 * that losing a user's note is not.
 *
 * @param name GA4 event name.
 * @param params Event parameters, if any.
 */
export function track(name: string, params?: EventParams): void {
  if (analytics === null) {
    return;
  }

  logEvent(analytics, name, params);
}

/**
 * Associates subsequent events with a user, or clears the association.
 *
 * **This does not clear the Firebase Installation ID.** That identifier is
 * registered with Google, survives sign-out, and is what ties two sessions on
 * one browser together. Clearing it needs `deleteInstallations()` in the
 * sign-out path. See `src/lib/local-db/spec.md`.
 *
 * @param userId The signed-in user's id, or `null` on sign-out.
 */
export function identify(userId: string | null): void {
  if (analytics === null) {
    return;
  }

  setUserId(analytics, userId);
}

/**
 * Grants analytics storage consent, once something is able to ask for it.
 *
 * Exported now so the consent posture lives in one file rather than being
 * rediscovered by whoever builds the banner. Nothing calls it yet.
 */
export function grantAnalyticsConsent(): void {
  setConsent({ analytics_storage: 'granted' });
}
