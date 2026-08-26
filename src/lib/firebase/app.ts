import 'client-only';
import type { FirebaseApp } from 'firebase/app';
import { getApps, initializeApp } from 'firebase/app';
import { Env } from '@/lib/env';

/**
 * Whether every value `initializeApp` needs is present.
 *
 * The four variables are `.optional()` in `src/lib/env.ts`, so a checkout with
 * no Firebase project still builds and runs — it simply reports nothing and
 * reads every flag from its in-repo default. `.optional()` on its own would
 * leave the same orphan `NEXT_PUBLIC_POSTHOG_KEY` was; this named gate is what
 * gives the variables a reader. `src/lib/observability/logger.ts` is the
 * pattern.
 */
const isFirebaseConfigured =
  Boolean(Env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  Boolean(Env.NEXT_PUBLIC_FIREBASE_APP_ID) &&
  Boolean(Env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  Boolean(Env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);

/**
 * The one Firebase app instance, or `null` when the project is not configured.
 *
 * `measurementId` is not optional in practice. Without it the SDK fetches the
 * web config from `firebase.googleapis.com` on every cold start — a blocking
 * round-trip before anything reports, and a sixth origin in the CSP. It is
 * cheaper to require it than to allow it to be missing.
 *
 * `getApps()` is consulted first because Next.js hot-reloads this module in
 * development and `initializeApp` throws on a duplicate app name.
 *
 * @returns The initialised app, or `null` when Firebase is not configured.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) {
    return null;
  }

  const existing = getApps().at(0);

  if (existing !== undefined) {
    return existing;
  }

  return initializeApp({
    apiKey: Env.NEXT_PUBLIC_FIREBASE_API_KEY,
    appId: Env.NEXT_PUBLIC_FIREBASE_APP_ID,
    projectId: Env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    measurementId: Env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
}
