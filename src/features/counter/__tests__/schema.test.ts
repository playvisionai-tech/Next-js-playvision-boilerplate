import { describe, expect, it } from 'vitest';
import { counterIncrementSchema } from '../schema';

describe('Counter increment schema', () => {
  it('accepts the lowest allowed increment', () => {
    expect(counterIncrementSchema.safeParse({ increment: 1 }).success).toBeTruthy();
  });

  it('accepts the highest allowed increment', () => {
    expect(counterIncrementSchema.safeParse({ increment: 3 }).success).toBeTruthy();
  });

  it('rejects an increment below the range', () => {
    expect(counterIncrementSchema.safeParse({ increment: 0 }).success).toBeFalsy();
  });

  it('rejects an increment above the range', () => {
    expect(counterIncrementSchema.safeParse({ increment: 4 }).success).toBeFalsy();
  });

  it('rejects a non-numeric increment', () => {
    expect(counterIncrementSchema.safeParse({ increment: '2' }).success).toBeFalsy();
  });

  it('rejects a payload with no increment at all', () => {
    expect(counterIncrementSchema.safeParse({}).success).toBeFalsy();
  });
});
