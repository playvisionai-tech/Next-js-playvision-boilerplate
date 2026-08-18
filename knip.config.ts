import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: ['checkly.config.ts', 'src/lib/i18n/index.ts', 'src/types/I18n.ts'],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    // Resolved by name at runtime from the `import/resolver` setting, so no
    // static import exists for knip to find.
    'eslint-import-resolver-typescript',
    '@swc/helpers', // Required at runtime by the SWC output but not imported directly.
  ],
  // The service worker and its build config are entry points: nothing in the
  // app imports them, the build step and the browser load them. Listed as
  // additions so Next.js's own entry points are not replaced.
  entry: [
    'src/app/sw.ts!',
    'serwist.config.js!',
    // The UI kit is a surface, not a consumed module: a primitive can be
    // correct and documented in spec.md before any feature reaches for it.
    // Its inventory is the review gate, not knip.
    'src/components/ui/*.tsx!',
  ],
  // ESLint runs only the import-boundary rules, from a non-default filename
  // so Ultracite does not mistake it for the project's primary linter.
  eslint: {
    config: ['eslint.boundaries.config.mjs'],
  },
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['e2e/**/*.e2e.ts'],
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/gu)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
