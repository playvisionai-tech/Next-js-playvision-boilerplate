import { serwist } from '@serwist/next/config';

/**
 * Serwist runs as a build step rather than a bundler plugin, because the
 * plugin form does not support Turbopack and Next builds with Turbopack by
 * default — under the plugin the build succeeded and silently emitted no
 * service worker at all.
 *
 * Built by `pnpm build:next` after `next build`. Never in development.
 *
 * @returns The Serwist build options, resolved against the Next.js config.
 */
export default serwist.withNextConfig(() => ({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  globDirectory: '.next',
}));
