import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { AppConfig } from '@/lib/config';
import { routing } from '@/lib/i18n/routing';
import { appManifest } from '../manifest';

/**
 * The icon sizes Chrome, Edge and Android require, both `purpose: 'any'`,
 * before they will offer to install a web app.
 */
const INSTALL_PROMPT_ICON_SIZES = ['192x192', '512x512'];

const PUBLIC_DIR = path.join(process.cwd(), 'public');

/**
 * The pixel dimensions a PNG actually has, read from its IHDR header.
 *
 * The manifest states a size for every icon and the browser believes it. Only
 * the file itself can say whether that claim is true.
 *
 * @param file Absolute path to a PNG.
 * @returns Its width and height in pixels.
 */
function pngSize(file: string): { width: number; height: number } {
  const header = fs.readFileSync(file).subarray(16, 24);

  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

describe('Web app manifest', () => {
  const manifest = appManifest();
  const icons = manifest.icons ?? [];

  it('asks the OS for a standalone window, which is what an install is for', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('opens at the locale-negotiated root rather than freezing a locale at install time', () => {
    expect(manifest.start_url).toBe('/');

    for (const locale of routing.locales) {
      expect(manifest.start_url).not.toBe(`/${locale}`);
    }
  });

  it('scopes the whole origin, so start_url is inside it and links stay in the app', () => {
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url?.startsWith(manifest.scope ?? '')).toBeTruthy();
  });

  it('carries a stable id, so changing start_url later updates this app instead of adding one', () => {
    expect(manifest.id).toBe('/');
  });

  /**
   * A tripwire, not a preference. The app is NOT installable on Chrome, Edge or
   * Android, and this asserts the gap rather than hiding it: the only source art
   * in `public/` is 180x180, and upscaling it was refused. When someone adds
   * `icon-192x192.png` and `icon-512x512.png` and declares them, this fails —
   * which is the point. Delete it in the same change that rewrites the
   * "Installability" section of `spec.md`, because that section will then be a
   * lie in the other direction.
   */
  it('declares neither icon an install prompt needs, because the art does not exist yet', () => {
    const declared = icons.map((icon) => icon.sizes);

    for (const size of INSTALL_PROMPT_ICON_SIZES) {
      expect(
        declared,
        `${size} is declared now — add the file to public/ and rewrite the Installability section of spec.md, then delete this test`,
      ).not.toContain(size);
    }
  });

  it('names only icons that exist, at the size it claims for them', () => {
    expect(icons.length).toBeGreaterThan(0);

    for (const icon of icons) {
      const file = path.join(PUBLIC_DIR, icon.src);

      expect(fs.existsSync(file), `${icon.src} is not in public/`).toBeTruthy();

      const { width, height } = pngSize(file);

      expect(`${width}x${height}`).toBe(icon.sizes);
    }
  });

  it('promises no maskable icon, because none of the art has a safe zone', () => {
    for (const icon of icons) {
      expect(icon.purpose).toBe('any');
    }
  });

  it('ships identity rather than one locale of copy handed to every locale', () => {
    expect(manifest.name).toBe(AppConfig.name);
    expect(manifest.short_name).toBe(AppConfig.name);
    expect(manifest.description).toBeUndefined();
    expect(manifest.lang).toBeUndefined();
  });
});
