import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

/**
 * Import boundaries only.
 *
 * Ultracite/Oxlint owns formatting, style, correctness, and type-aware rules
 * (`pnpm lint`). ESLint is here for one job Oxlint cannot do: `import/
 * no-restricted-paths`, which expresses directional zones between layers.
 * See agents/rules/architecture-feature-slices.md.
 *
 * Adding rules here that Oxlint already covers means two linters disagreeing
 * about the same file. Don't.
 *
 * The filename is deliberately NOT eslint.config.mjs: Ultracite treats that
 * name as "this project lints with ESLint" and switches its whole pipeline
 * from Oxlint/Oxfmt to ESLint/Prettier/Stylelint. Run this one explicitly via
 * `pnpm check:boundaries`.
 */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'migrations/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      'import/no-cycle': ['error', { maxDepth: 10 }],

      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Shared layers may not reach up into features or routing.
            {
              target: './src/components',
              from: './src/features',
              message:
                'components/ may not import features/. Promote what you need, or keep the component in the feature.',
            },
            {
              target: './src/components',
              from: './src/app',
              message: 'components/ may not import app/.',
            },
            {
              target: './src/lib',
              from: './src/features',
              message:
                'lib/ may not import features/. Infrastructure does not know about capabilities.',
            },
            {
              target: './src/lib',
              from: './src/app',
              message: 'lib/ may not import app/.',
            },
            {
              target: './src/types',
              from: './src/features',
              message: 'types/ may not import features/.',
            },

            // Features may not import routing.
            {
              target: './src/features',
              from: './src/app',
              message: 'features/ may not import app/. Routes render features, never the reverse.',
            },

            // Routes may not touch infrastructure directly.
            {
              target: './src/app',
              from: './src/lib/db',
              message:
                'Route files may not import lib/db. Data access belongs in features/<f>/server/.',
            },
            {
              target: './src/app',
              from: './src/lib/local-db',
              message:
                'Route files may not import lib/local-db. Browser storage belongs in features/<f>/local/.',
            },

            // No cross-feature imports. One zone per feature; the `new-feature`
            // skill appends these, because a missing zone fails open.
            {
              target: './src/features/counter',
              from: './src/features',
              except: ['./counter'],
              message: 'No cross-feature imports. Share via components/ui or lib/.',
            },
            {
              target: './src/features/portfolio',
              from: './src/features',
              except: ['./portfolio'],
              message: 'No cross-feature imports. Share via components/ui or lib/.',
            },
          ],
        },
      ],
    },
  },
];
