import 'client-only';
import type { RemoteConfig } from 'firebase/remote-config';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { Env } from '@/lib/env';
import { getFirebaseApp } from './app';
import type { FlagKey } from './flag-keys';
import { FLAG_DEFAULTS, FLAG_KEYS } from './flag-keys';

/**
 * Remote Config's own default, restated rather than relied upon.
 *
 * Twelve hours is how long a fetched template is considered fresh, and it is
 * therefore the real propagation delay of a flag change. Anyone treating these
 * as a kill switch needs to know that number before they need it at 2am.
 */
const PRODUCTION_FETCH_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * Development refetches every minute so a console change shows up in a reload.
 * Not zero: the SDK throttles aggressive fetching and answers `FETCH_THROTTLE`,
 * which reads like a bug and is not one.
 */
const DEVELOPMENT_FETCH_INTERVAL_MS = 60 * 1000;

let remoteConfig: RemoteConfig | null = null;

/**
 * Fetches and activates the flag template.
 *
 * A failure here is deliberately swallowed. Remote Config is unreachable
 * offline, behind an ad-blocker, and in any checkout with no Firebase project,
 * and none of those should take a page down — `getFlag` falls back to
 * `FLAG_DEFAULTS`, which is why the defaults are the contract.
 *
 * @returns Resolves once flags are readable, or immediately when they are not.
 */
export async function initFlags(): Promise<void> {
  const app = getFirebaseApp();

  if (app === null) {
    return;
  }

  const config = getRemoteConfig(app);

  config.defaultConfig = { ...FLAG_DEFAULTS };
  config.settings.minimumFetchIntervalMillis =
    Env.NODE_ENV === 'production' ? PRODUCTION_FETCH_INTERVAL_MS : DEVELOPMENT_FETCH_INTERVAL_MS;

  try {
    await fetchAndActivate(config);
  } catch {
    // Defaults stand. A flag service outage is not a page outage.
  }

  remoteConfig = config;
}

/**
 * Reads one flag.
 *
 * @param key A declared flag name.
 * @returns The active value, or the in-repo default when Remote Config has not answered.
 */
export function getFlag(key: FlagKey): boolean {
  if (remoteConfig === null) {
    return FLAG_DEFAULTS[key];
  }

  return getValue(remoteConfig, key).asBoolean();
}

/**
 * Every flag at once, for handing to React as one immutable snapshot.
 *
 * @returns The current value of every declared flag.
 */
export function readFlags(): Record<FlagKey, boolean> {
  const flags: Record<FlagKey, boolean> = { ...FLAG_DEFAULTS };

  for (const key of FLAG_KEYS) {
    flags[key] = getFlag(key);
  }

  return flags;
}
