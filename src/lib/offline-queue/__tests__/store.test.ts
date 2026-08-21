import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '@/lib/local-db/client';
import {
  ackWrite,
  countPending,
  countRejected,
  discardRejected,
  enqueueWrite,
  listSendable,
  MAX_ATTEMPTS,
  recordAttempt,
  rejectWrite,
  retryRejected,
} from '../store';

const QUEUE = 'test-queue';

type TestPayload = { increment: number };

const enqueue = async (increment: number, mutationId: string) => {
  await enqueueWrite({ queue: QUEUE, payload: { increment }, mutationId });
};

const idOf = async (index = 0) => {
  const rows = await listSendable<TestPayload>(QUEUE);
  const row = rows[index];

  if (row?.id === undefined) {
    throw new Error('expected a queued row with an id');
  }

  return row.id;
};

describe('Offline write queue', () => {
  beforeEach(async () => {
    await localDb.pendingWrites.clear();
  });

  it('reads back a queued write with its payload intact', async () => {
    await enqueue(2, 'mutation-a');

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.increment).toBe(2);
    expect(rows[0]?.mutationId).toBe('mutation-a');
  });

  it('offers only the rows queued under the same name', async () => {
    await enqueue(1, 'mutation-a');
    await enqueueWrite({
      queue: 'other-queue',
      payload: { increment: 9 },
      mutationId: 'mutation-b',
    });

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mutationId).toBe('mutation-a');
    await expect(countPending(QUEUE)).resolves.toBe(1);
  });

  it('keeps rows queued until they are acked', async () => {
    await enqueue(1, 'mutation-a');
    await enqueue(1, 'mutation-b');

    await expect(countPending(QUEUE)).resolves.toBe(2);

    await ackWrite(await idOf());

    await expect(countPending(QUEUE)).resolves.toBe(1);
  });

  it('removes only the acked row', async () => {
    await enqueue(1, 'mutation-a');
    await enqueue(3, 'mutation-b');

    await ackWrite(await idOf());

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mutationId).toBe('mutation-b');
  });

  it('stops offering a row once it fails permanently', async () => {
    await enqueue(1, 'mutation-a');

    await rejectWrite(await idOf(), 'increment out of range');

    await expect(countPending(QUEUE)).resolves.toBe(0);
    await expect(countRejected(QUEUE)).resolves.toBe(1);
  });

  it('keeps a row sendable after repeated transient failures', async () => {
    await enqueue(1, 'mutation-a');
    const id = await idOf();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAttempt(id, attempt);
    }

    // Exhausting attempts is evidence that sending failed, never evidence that
    // the write did not apply. Only the server can settle that, so the row is
    // still pending and it is the caller's job to ask.
    await expect(countPending(QUEUE)).resolves.toBe(1);
    await expect(countRejected(QUEUE)).resolves.toBe(0);
  });

  it('reports the attempt count including the one just recorded', async () => {
    await enqueue(1, 'mutation-a');
    const id = await idOf();

    await expect(recordAttempt(id, 0)).resolves.toBe(1);
    await expect(recordAttempt(id, 1)).resolves.toBe(2);
  });

  it('keeps retrying below the attempt cap', async () => {
    await enqueue(1, 'mutation-a');

    await recordAttempt(await idOf(), 0);

    await expect(countPending(QUEUE)).resolves.toBe(1);
    await expect(countRejected(QUEUE)).resolves.toBe(0);
  });

  it('returns a rejected row to the queue on retry', async () => {
    await enqueue(2, 'mutation-a');

    await rejectWrite(await idOf(), 'unreachable');
    await retryRejected(QUEUE);

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mutationId).toBe('mutation-a');
    await expect(countRejected(QUEUE)).resolves.toBe(0);
  });

  it('resets attempts on retry so the row gets a full run of tries', async () => {
    await enqueue(1, 'mutation-a');
    const id = await idOf();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAttempt(id, attempt);
    }

    await rejectWrite(id, 'unreachable');
    await retryRejected(QUEUE);

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows[0]?.attempts).toBe(0);
  });

  it('leaves already-pending rows untouched on retry', async () => {
    await enqueue(1, 'mutation-a');
    await enqueue(2, 'mutation-b');

    await recordAttempt(await idOf(1), 0);
    await rejectWrite(await idOf(), 'increment out of range');
    await retryRejected(QUEUE);

    const rows = await listSendable<TestPayload>(QUEUE);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.mutationId === 'mutation-b')?.attempts).toBe(1);
  });

  it('discards rejected rows without touching pending ones', async () => {
    await enqueue(1, 'mutation-a');
    await enqueue(2, 'mutation-b');

    await rejectWrite(await idOf(), 'increment out of range');
    await discardRejected(QUEUE);

    await expect(countRejected(QUEUE)).resolves.toBe(0);
    await expect(countPending(QUEUE)).resolves.toBe(1);
  });

  it('leaves rejected rows in another queue alone when discarding', async () => {
    await enqueue(1, 'mutation-a');
    await enqueueWrite({
      queue: 'other-queue',
      payload: { increment: 1 },
      mutationId: 'mutation-b',
    });

    const [other] = await listSendable('other-queue');

    if (other?.id === undefined) {
      throw new Error('expected a queued row with an id');
    }

    await rejectWrite(await idOf(), 'increment out of range');
    await rejectWrite(other.id, 'increment out of range');
    await discardRejected(QUEUE);

    await expect(countRejected(QUEUE)).resolves.toBe(0);
    await expect(countRejected('other-queue')).resolves.toBe(1);
  });
});
