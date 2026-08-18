import 'client-only';
import type { EntityTable } from 'dexie';
import Dexie from 'dexie';

/**
 * Anything queued while the browser was offline, waiting to reach the server.
 */
type PendingIncrement = {
  id?: number;
  increment: number;
  queuedAt: number;
};

/**
 * IndexedDB versioning is global per database name: two features opening the
 * same database at different versions block each other, and it presents as a
 * hang rather than an error. So one module owns the name, the version, and
 * every store. Features own their queries, not their connection.
 *
 * Bumping DATABASE_VERSION is a breaking change for every open tab. See
 * decisions.md before doing it.
 */
const DATABASE_NAME = 'playvision-local';
const DATABASE_VERSION = 1;

class LocalDatabase extends Dexie {
  declare pendingIncrements: EntityTable<PendingIncrement, 'id'>;

  constructor() {
    super(DATABASE_NAME);

    this.version(DATABASE_VERSION).stores({
      pendingIncrements: '++id, queuedAt',
    });
  }
}

export const localDb = new LocalDatabase();

/** Channel name for telling other tabs that a store changed. */
export const LOCAL_DB_CHANNEL = 'playvision-local-db';

/**
 * Tells other tabs that a store changed.
 *
 * The message is a signal, never the value. Broadcasting values makes every
 * tab a writer with no arbiter; broadcasting "this changed" leaves one store
 * and many readers.
 *
 * @param store Name of the store that changed.
 */
export function announceChange(store: string) {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  const channel = new BroadcastChannel(LOCAL_DB_CHANNEL);
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel.postMessage takes no targetOrigin; the rule targets window.postMessage.
  channel.postMessage({ store });
  channel.close();
}
