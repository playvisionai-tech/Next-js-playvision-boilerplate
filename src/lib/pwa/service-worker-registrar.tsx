'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, in production builds only.
 *
 * Development is excluded deliberately: a stale worker serving yesterday's
 * bundle is the hardest bug in this stack to reproduce, and it will not
 * reproduce for whoever wrote it.
 *
 * @returns Nothing — it renders no markup.
 */
export const ServiceWorkerRegistrar = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // A failed registration must not take the page down with it: the app
        // works online without a worker, it just will not work offline.
      }
    };

    void register();
  }, []);

  return null;
};
