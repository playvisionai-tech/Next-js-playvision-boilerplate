import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  extends: [ultracite],
  singleQuote: true,
  // `.agents/` holds skills vendored from other repos, recorded in
  // skills-lock.json with a hash of their upstream content. Formatting them
  // would drift from that hash and be re-fought on every skill update, so
  // they are exempt for the same reason drizzle's output is.
  ignorePatterns: ['migrations/*', '*.md', '.agents/**'],
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: 'asc',
  },
  sortTailwindcss: {
    stylesheet: 'src/styles/global.css',
  },
});
