import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

/**
 * Flattens a nested catalog into dotted key paths.
 *
 * A repo-wide invariant rather than a test of any one module, which is why it
 * lives in the root __tests__ folder rather than beside a source file.
 *
 * @param value The catalog, or a nested branch of it.
 * @param prefix The dotted path accumulated so far.
 * @returns Every leaf key path in the branch.
 */
const collectKeys = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('Message catalogs', () => {
  it('gives every locale the same keys as the source locale', () => {
    const source = collectKeys(en).toSorted();
    const target = collectKeys(fr).toSorted();

    expect(target).toStrictEqual(source);
  });

  it('leaves no message empty', () => {
    const empty = Object.entries(en).flatMap(([namespace, entries]) =>
      Object.entries(entries as Record<string, string>)
        .filter(([, text]) => text.trim() === '')
        .map(([key]) => `${namespace}.${key}`),
    );

    expect(empty).toStrictEqual([]);
  });
});
