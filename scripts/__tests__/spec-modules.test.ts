import { describe, expect, it } from 'vitest';
import { getModuleDir, isModuleDoc, isTestFile, requiredDocs } from '../spec-modules.js';

describe(getModuleDir, () => {
  it('maps a feature file to its slice', () => {
    expect(getModuleDir('src/features/example/components/note-form.tsx')).toBe(
      'src/features/example',
    );
    expect(getModuleDir('src/features/example/server/queries.ts')).toBe('src/features/example');
  });

  it('maps a lib file to its module', () => {
    expect(getModuleDir('src/lib/offline-queue/store.ts')).toBe('src/lib/offline-queue');
  });

  it('treats the whole UI kit as one module, not one per primitive', () => {
    expect(getModuleDir('src/components/ui/button.tsx')).toBe('src/components/ui');
    expect(getModuleDir('src/components/ui/dialog.tsx')).toBe('src/components/ui');
  });

  it('owns no module for a loose file directly under a namespace', () => {
    expect(getModuleDir('src/lib/utils.ts')).toBeNull();
    expect(getModuleDir('src/lib/env.ts')).toBeNull();
  });

  it('does not treat a namespace __tests__ folder as a module', () => {
    // src/lib/__tests__ holds tests for the loose files above. Were it a
    // module it would be asked for a spec.md describing nothing.
    expect(getModuleDir('src/lib/__tests__/utils.test.ts')).toBeNull();
  });

  it('owns no module for routes, which hold no behavior of their own', () => {
    expect(getModuleDir('src/app/[locale]/(marketing)/page.tsx')).toBeNull();
  });

  it('owns no module for build tooling outside src', () => {
    expect(getModuleDir('scripts/check-specs.js')).toBeNull();
  });

  it('reads Windows-style separators', () => {
    expect(getModuleDir('src\\features\\example\\note-form.tsx')).toBe('src/features/example');
  });
});

describe(requiredDocs, () => {
  it('asks for spec.md and not decisions.md', () => {
    // AGENTS.md makes decisions.md conditional on a real fork in the road, so
    // requiring one per module would manufacture invented trade-offs.
    expect(requiredDocs().map((doc) => doc.name)).toStrictEqual(['spec.md']);
  });

  it('carries the reason with the requirement', () => {
    // A demanded document with no reason attached produces an error the author
    // cannot act on, which is how the previous reason table drifted into dead
    // entries for documents nothing required.
    for (const doc of requiredDocs()) {
      expect(doc.why).not.toBe('');
    }
  });
});

describe(isModuleDoc, () => {
  it("recognises the module's own documents", () => {
    expect(isModuleDoc('src/features/example/spec.md')).toBeTruthy();
    expect(isModuleDoc('src/features/example/decisions.md')).toBeTruthy();
    expect(isModuleDoc('src/components/ui/spec.md')).toBeTruthy();
  });

  it('does not accept a nested spec.md as the module’s own', () => {
    // Matched by basename, features/example/server/spec.md would have signed
    // off a behavior change in the slice while describing something else.
    expect(isModuleDoc('src/features/example/server/spec.md')).toBeFalsy();
    expect(isModuleDoc('src/features/example/local/decisions.md')).toBeFalsy();
  });

  it('does not count an unrelated markdown file', () => {
    expect(isModuleDoc('src/features/example/README.md')).toBeFalsy();
  });

  it('does not count a document belonging to no module', () => {
    expect(isModuleDoc('src/lib/spec.md')).toBeFalsy();
  });
});

describe(isTestFile, () => {
  it('recognises the documented __tests__ placement', () => {
    expect(isTestFile('src/features/example/__tests__/schema.test.ts')).toBeTruthy();
  });

  it('recognises stories, which describe no behavior either', () => {
    expect(isTestFile('src/components/ui/base-template.stories.tsx')).toBeTruthy();
  });

  it('does not count the code under test', () => {
    expect(isTestFile('src/features/example/schema.ts')).toBeFalsy();
  });
});
