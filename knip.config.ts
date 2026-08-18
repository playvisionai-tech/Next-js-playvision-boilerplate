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
  // ESLint runs only the import-boundary rules, from a non-default filename
  // so Ultracite does not mistake it for the project's primary linter.
  eslint: {
    config: ['eslint.boundaries.config.mjs'],
  },
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['e2e/**/*.e2e.ts'],
  },
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/gu)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
