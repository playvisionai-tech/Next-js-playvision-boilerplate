import Link from 'next/link';

/**
 * Root not-found. Reached when the URL has no valid locale segment, so there
 * is no i18n context to translate against — the copy is deliberately plain.
 *
 * @returns The rendered not-found document.
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-2xl px-1 py-10 text-center antialiased">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="mt-2 text-gray-600">The page you were looking for does not exist.</p>
          <Link
            className="mt-4 inline-block text-blue-700 hover:border-b-2 hover:border-blue-700"
            href="/"
          >
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}
