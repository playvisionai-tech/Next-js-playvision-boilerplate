'use client';

import 'client-only';
import { createContext, useContext, useEffect, useState } from 'react';
import { initAnalytics } from './analytics';
import type { FlagKey } from './flag-keys';
import { FLAG_DEFAULTS } from './flag-keys';
import { initFlags, readFlags } from './flags';

type Flags = Record<FlagKey, boolean>;

/**
 * Defaults, not `undefined`. A component reading a flag outside the provider —
 * in a test, in Storybook, during the first paint — gets the safe value rather
 * than a crash, which is the same contract `FLAG_DEFAULTS` makes everywhere
 * else.
 */
const FlagsContext = createContext<Flags>({ ...FLAG_DEFAULTS });

/**
 * Starts Analytics and Remote Config, and publishes the flag snapshot.
 *
 * Rendered once, from `src/app/[locale]/layout.tsx`. It wraps `children`, but
 * that costs nothing: the layout already renders them inside
 * `NextIntlClientProvider`, and children passed through a client component
 * stay server-rendered.
 *
 * Both SDKs start after mount, so **the first paint always shows defaults** and
 * a flag that resolves differently will visibly change. That flicker is
 * inherent to evaluating flags in the browser; the way to avoid it is to
 * evaluate on the server, which this app deliberately does not do — see
 * `decisions.md`.
 *
 * @param props Children to render inside the flag context.
 * @returns The children, wrapped in the flag context.
 */
export const FirebaseProvider = (props: { children: React.ReactNode }) => {
  const [flags, setFlags] = useState<Flags>({ ...FLAG_DEFAULTS });

  useEffect(() => {
    let active = true;

    const start = async () => {
      // Independent: a browser that refuses Analytics can still read flags.
      await Promise.all([initAnalytics(), initFlags()]);

      if (active) {
        setFlags(readFlags());
      }
    };

    void start();

    return () => {
      active = false;
    };
  }, []);

  return <FlagsContext.Provider value={flags}>{props.children}</FlagsContext.Provider>;
};

/**
 * Reads one feature flag.
 *
 * @param key A declared flag name. An unknown name is a type error.
 * @returns The active value, or its default until Remote Config has answered.
 */
export function useFlag(key: FlagKey): boolean {
  return useContext(FlagsContext)[key];
}
