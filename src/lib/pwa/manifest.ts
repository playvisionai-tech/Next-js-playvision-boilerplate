import type { MetadataRoute } from 'next';
import { AppConfig } from '@/lib/config';

/**
 * The colour behind the app before its first paint, and behind the OS install
 * and splash UI.
 *
 * It mirrors `--background` in the light theme (`oklch(1 0 0)`). A web app
 * manifest is static JSON served to an OS installer, not a stylesheet: it
 * cannot read a CSS custom property, and the installer is not a CSS parser, so
 * the value is written here as hex. This is the only place in the app a colour
 * is stated twice — see `decisions.md`.
 */
const APP_COLOR = '#ffffff';

/**
 * The icons the OS may choose from, largest first.
 *
 * Every entry names a file committed to `public/`, at the size it claims.
 *
 * **This list is why the app cannot be installed on Chrome, Edge or Android.**
 * Those browsers require a 192x192 and a 512x512 icon, both `purpose: 'any'`,
 * before they offer an install prompt. `public/` has neither and no source art
 * to make them from, and upscaling the 180x180 is a 2.8x blur — see
 * `decisions.md`. iOS is unaffected: "Add to Home Screen" reads the
 * `apple-touch-icon` link tag, not this array.
 *
 * None is declared `maskable`. A maskable icon promises its art stays legible
 * after the platform crops it to a circle or a squircle, and none of these was
 * drawn with that safe zone — claiming it would ship a clipped logo.
 */
const icons: MetadataRoute.Manifest['icons'] = [
  { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
  { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
  { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
];

/**
 * The web app manifest, served from the single root route `/manifest.webmanifest`.
 *
 * It carries no translated copy. `name` and `short_name` are the product's
 * name, which is identity rather than prose, and it is read from `AppConfig`
 * for the same reason the footer reads it from there. There is one manifest for
 * the whole origin and it has no locale, so anything from `src/messages/` would
 * have to be one locale's copy handed to every locale's users, frozen at the
 * moment they installed.
 *
 * `start_url` is `/`, the locale-negotiated entry point, not `/en`. With
 * `localePrefix: 'as-needed'` the default locale has no prefix, so `/` is the
 * one path that lets the app decide the locale on launch instead of the
 * manifest deciding it at install time.
 *
 * @returns The manifest object Next serialises to `/manifest.webmanifest`.
 */
export function appManifest(): MetadataRoute.Manifest {
  return {
    // Pinned so a later change to start_url is an update to this app rather
    // than the OS treating it as a second, unrelated one.
    id: '/',
    name: AppConfig.name,
    short_name: AppConfig.name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: APP_COLOR,
    theme_color: APP_COLOR,
    icons,
  };
}
