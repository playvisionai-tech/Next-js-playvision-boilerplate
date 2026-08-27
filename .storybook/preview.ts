import '../src/styles/global.css';
import type { Preview } from '@storybook/nextjs-vite';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/iu,
        date: /Date$/iu,
      },
    },
    nextjs: {
      appDirectory: true, // Enable App Router support
    },
    docs: {
      toc: true, // Enable table of contents
    },
    a11y: {
      // 'error' fails the test run on any axe violation. 'todo' — the value
      // this shipped with — reports violations and passes anyway, which made
      // the storybook CI job incapable of reporting the one thing it exists
      // for. A story that has a known, accepted violation opts out per-story
      // with `parameters.a11y.test = 'off'` and says why; nothing opts out
      // globally.
      test: 'error',
    },
  },
  tags: ['autodocs'],
};

export default preview;
