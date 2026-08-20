import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '@/lib/local-db/client';
import {
  ackIncrement,
  countPending,
  countRejected,
  discardRejected,
  enqueueIncrement,
  listSendable,
  MAX_ATTEMPTS,
  recordAttempt,
  rejectIncrement,
  retryRejected,
} from '../queue';

const idOf = async (index = 0) => {
  const rows = await listSendable();
  const row = rows[index];

  if (row?.id === undefined) {
    throw new Error('expected a queued row with an id');
  }

  return row.id;
};

describe('Offline increment queue', () => {
  beforeEach(async () => {
    await localDb.pendingIncrements.clear();
  });

  it('reads back a queued increment', async () => {
    await enqueueIncrement(2, 'mutation-a');

    const rows = await listSendable();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.increment).toBe(2);
    expect(rows[0]?.mutationId).toBe('mutation-a');
  });

  it('keeps rows queued until they are acked', async () => {
    await enqueueIncrement(1, 'mutation-a');
    await enqueueIncrement(1, 'mutation-b');

    await expect(countPending()).resolves.toBe(2);

    await ackIncrement(await idOf());

    await expect(countPending()).resolves.toBe(1);
  });

  it('removes only the acked row', async () => {
    await enqueueIncrement(1, 'mutation-a');
    await enqueueIncrement(3, 'mutation-b');

    await ackIncrement(await idOf());

    const rows = await listSendable();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mutationId).toBe('mutation-b');
  });

  it('stops offering a row once it fails permanently', async () => {
    await enqueueIncrement(1, 'mutation-a');

    await rejectIncrement(await idOf(), 'increment out of range');

    await expect(countPending()).resolves.toBe(0);
    await expect(countRejected()).resolves.toBe(1);
  });

  it('keeps a row sendable after repeated transient failures', async () => {
    await enqueueIncrement(1, 'mutation-a');
    const id = await idOf();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAttempt(id, attempt);
    }

    // Exhausting attempts is evidence that sending failed, never evidence that
    // the write did not apply. Only the server can settle that, so the row is
    // still pending and it is the caller's job to ask.
    await expect(countPending()).resolves.toBe(1);
    await expect(countRejected()).resolves.toBe(0);
  });

  it('reports the attempt count including the one just recorded', async () => {
    await enqueueIncrement(1, 'mutation-a');
    const id = await idOf();

    await expect(recordAttempt(id, 0)).resolves.toBe(1);
    await expect(recordAttempt(id, 1)).resolves.toBe(2);
  });

  it('keeps retrying below the attempt cap', async () => {
    await enqueueIncrement(1, 'mutation-a');

    await recordAttempt(await idOf(), 0);

    await expect(countPending()).resolves.toBe(1);
    await expect(countRejected()).resolves.toBe(0);
  });

  it('returns a rejected row to the queue on retry', async () => {
    await enqueueIncrement(2, 'mutation-a');

    await rejectIncrement(await idOf(), 'unreachable');
    await retryRejected();

    const rows = await listSendable();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mutationId).toBe('mutation-a');
    await expect(countRejected()).resolves.toBe(0);
  });

  it('resets attempts on retry so the row gets a full run of tries', async () => {
    await enqueueIncrement(1, 'mutation-a');
    const id = await idOf();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAttempt(id, attempt);
    }

    await rejectIncrement(id, 'unreachable');
    await retryRejected();

    const rows = await listSendable();

    expect(rows[0]?.attempts).toBe(0);
  });

  it('leaves already-pending rows untouched on retry', async () => {
    await enqueueIncrement(1, 'mutation-a');
    await enqueueIncrement(2, 'mutation-b');

    await recordAttempt(await idOf(1), 0);
    await rejectIncrement(await idOf(), 'increment out of range');
    await retryRejected();

    const rows = await listSendable();

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.mutationId === 'mutation-b')?.attempts).toBe(1);
  });

  it('discards rejected rows without touching pending ones', async () => {
    await enqueueIncrement(1, 'mutation-a');
    await enqueueIncrement(2, 'mutation-b');

    await rejectIncrement(await idOf(), 'increment out of range');
    await discardRejected();

    await expect(countRejected()).resolves.toBe(0);
    await expect(countPending()).resolves.toBe(1);
  });
});
