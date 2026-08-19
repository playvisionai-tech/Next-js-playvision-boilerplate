import { describe, expect, it } from 'vitest';
import { counterIncrementSchema } from '../schema';

const MUTATION_ID = '0b5f4a2e-9a1e-4c7f-9c2f-2a3b4c5d6e7f';

describe('Counter increment schema', () => {
  it('accepts the lowest allowed increment', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: 1, mutationId: MUTATION_ID }).success,
    ).toBeTruthy();
  });

  it('accepts the highest allowed increment', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: 3, mutationId: MUTATION_ID }).success,
    ).toBeTruthy();
  });

  it('rejects an increment below the range', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: 0, mutationId: MUTATION_ID }).success,
    ).toBeFalsy();
  });

  it('rejects an increment above the range', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: 4, mutationId: MUTATION_ID }).success,
    ).toBeFalsy();
  });

  it('rejects a non-numeric increment', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: '2', mutationId: MUTATION_ID }).success,
    ).toBeFalsy();
  });

  it('rejects a payload with no increment at all', () => {
    expect(counterIncrementSchema.safeParse({}).success).toBeFalsy();
  });

  it('rejects a payload with no mutation id', () => {
    expect(counterIncrementSchema.safeParse({ increment: 1 }).success).toBeFalsy();
  });

  it('rejects a mutation id that is not a uuid', () => {
    expect(
      counterIncrementSchema.safeParse({ increment: 1, mutationId: 'not-a-uuid' }).success,
    ).toBeFalsy();
  });
});
