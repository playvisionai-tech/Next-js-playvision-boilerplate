import 'client-only';
import type { EntityTable } from 'dexie';
import Dexie from 'dexie';

/**
 * Anything queued while it could not reach the server, waiting to be sent.
 *
 * The envelope is fixed and the payload is opaque: this module never reads
 * inside it. That is what keeps the store — and the database version it shares
 * with every other store — independent of the features queueing into it.
 * `lib/offline-queue` owns the reading and writing of these rows.
 */
type PendingWrite = {
  id?: number;
  /** Which feature's queue the row belongs to, so one never sends another's rows. */
  queue: string;
  /** Feature-owned. Only the caller that queued it knows its shape. */
  payload: unknown;
  /** Client-generated; makes the server-side write idempotent on retry. */
  mutationId: string;
  queuedAt: number;
  /** Transient failures so far. At the cap the queue asks the server before rejecting. */
  attempts: number;
  /** Set when the write failed permanently. Kept so the user can see it. */
  rejectedReason?: string;
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
const DATABASE_VERSION = 3;

class LocalDatabase extends Dexie {
  declare pendingWrites: EntityTable<PendingWrite, 'id'>;

  constructor() {
    super(DATABASE_NAME);

    // v1 shipped without mutationId/attempts. Existing rows are dropped rather
    // than migrated: they carry no mutation id, so replaying them could
    // double-count, and a demo counter is not worth a backfill.
    this.version(1).stores({ pendingIncrements: '++id, queuedAt' });
    this.version(2)
      .stores({ pendingIncrements: '++id, queuedAt, rejectedReason' })
      .upgrade(async (tx) => {
        await tx.table('pendingIncrements').clear();
      });
    // v3 replaced the counter-shaped store with one any feature can queue into.
    // Rows in the old store are not carried across: mapping its columns onto a
    // queue name and a payload is knowledge of the feature that wrote them, and
    // this module deliberately has none. See decisions.md.
    this.version(DATABASE_VERSION).stores({
      pendingIncrements: null,
      pendingWrites: '++id, queue, queuedAt, rejectedReason',
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
