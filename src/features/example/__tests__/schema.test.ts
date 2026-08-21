import { describe, expect, it } from 'vitest';
import { noteInputSchema, noteSchema } from '../schema';

const MUTATION_ID = '0b5f4a2e-9a1e-4c7f-9c2f-2a3b4c5d6e7f';

describe('Example note schema', () => {
  describe('Form input', () => {
    it('accepts a note the user could type', () => {
      expect(noteInputSchema.safeParse({ body: 'Ship it' }).success).toBeTruthy();
    });

    it('rejects a note that is only whitespace', () => {
      expect(noteInputSchema.safeParse({ body: '   ' }).success).toBeFalsy();
    });

    it('rejects a note longer than the column allows', () => {
      expect(noteInputSchema.safeParse({ body: 'a'.repeat(81) }).success).toBeFalsy();
    });

    it('leaves the mutation id out, so the resolver never blocks on it', () => {
      expect(noteInputSchema.safeParse({ body: 'Ship it' }).success).toBeTruthy();
    });
  });

  describe('Server Action input', () => {
    it('accepts a note carrying a mutation id', () => {
      expect(
        noteSchema.safeParse({ body: 'Ship it', mutationId: MUTATION_ID }).success,
      ).toBeTruthy();
    });

    it('rejects a payload with no mutation id', () => {
      expect(noteSchema.safeParse({ body: 'Ship it' }).success).toBeFalsy();
    });

    it('rejects a mutation id that is not a uuid', () => {
      expect(noteSchema.safeParse({ body: 'Ship it', mutationId: 'nope' }).success).toBeFalsy();
    });

    it('rejects an empty note even with a valid mutation id', () => {
      expect(noteSchema.safeParse({ body: '', mutationId: MUTATION_ID }).success).toBeFalsy();
    });
  });
});
