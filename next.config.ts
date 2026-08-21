import './src/lib/env';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Content Security Policy, shipped in report-only mode.
 *
 * Enforcing a policy you have not measured breaks something you did not know
 * was there, usually in a browser nobody tests. Run report-only for a release,
 * read the violations, then switch the header name to Content-Security-Policy.
 *
 * Every third party listed here widened the policy deliberately. Adding an
 * origin means saying why in that module's spec.md; never add `*` or
 * `unsafe-eval` to make an error go away.
 */
// Note: `upgrade-insecure-requests` is deliberately absent. Browsers ignore it
// in a report-only policy and log a console error for every page load; add it
// when the policy switches to enforcing.
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is required until a nonce is threaded through proxy.ts:
  // Next injects inline scripts for hydration and streaming.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.sentry.io https://*.ingest.sentry.io",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.clerk.accounts.dev",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * File extensions Next.js treats as routable.
 *
 * `dev.tsx` is registered only outside production, and it is what keeps
 * `src/features/example/`'s route — `page.dev.tsx` — out of a production build.
 * Next simply does not recognise the file as a page there: the route is absent
 * from the manifest, nothing imports the slice, and none of it is bundled. A
 * runtime `notFound()` would have shipped the code and only hidden the URL.
 *
 * `dev.tsx` must come first. Next strips the extension with an alternation
 * built from this list, and with `tsx` first `page.dev.tsx` resolves to a page
 * named `page.dev`, which is not a route.
 *
 * Delete this block along with the example slice if nothing else needs a
 * development-only route.
 */
const pageExtensions =
  process.env.NODE_ENV === 'production'
    ? ['tsx', 'ts', 'jsx', 'js']
    : ['dev.tsx', 'tsx', 'ts', 'jsx', 'js'];

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  pageExtensions,
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: process.env.NODE_ENV === 'production', // Keep the development environment fast
  logging: {
    browserToTerminal: process.env.BROWSER_TO_TERMINAL_DISABLED !== 'true',
  },
  outputFileTracingIncludes: {
    '/': ['./migrations/**/*'],
  },
  // A self-contained server that runs in a container anywhere. Host-specific
  // configuration belongs in the deployment repo, not in the template.
  output: 'standalone',
  headers: () => [
    {
      source: '/:path*',
      headers: securityHeaders,
    },
  ],
};

// Initialize the Next-Intl plugin
let configWithPlugins = createNextIntlPlugin('./src/lib/i18n/index.ts')(baseConfig);

// Conditionally enable bundle analysis
if (process.env.ANALYZE === 'true') {
  configWithPlugins = withBundleAnalyzer()(configWithPlugins);
}

// Conditionally enable Sentry configuration
if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options
    org: process.env.SENTRY_ORGANIZATION,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    webpack: {
      reactComponentAnnotation: {
        enabled: true,
      },

      // Tree-shake Sentry logger statements to reduce bundle size
      treeshake: {
        removeDebugLogging: true,
      },
    },

    // Disable Sentry telemetry
    telemetry: false,
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
