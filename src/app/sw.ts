/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging into WorkerGlobalScope requires an interface.
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Caches the app shell so the page loads without a network.
 *
 * It caches the shell and nothing else. Content stays in IndexedDB and on the
 * server: two caches over the same data drift, and the one nobody thought
 * about wins.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
