---
title: Route files hold routing concerns and nothing else
impact: HIGH
impactDescription: Keeps navigation restructurable without touching behavior
paths:
  - 'src/app/**/page.tsx'
  - 'src/app/**/layout.tsx'
tags: architecture, routing
---

## Route files hold routing concerns and nothing else

A file under `src/app/` may contain exactly: `metadata` or `generateMetadata`,
`generateStaticParams`, awaiting `params` and `searchParams`, segment config
(`revalidate`, `dynamic`, `runtime`), `Suspense` and error boundaries, and one
component imported from `features/`.

This is an allowlist, not "re-export only" — metadata and static params genuinely
belong to the route. Widening it past this list is how business logic ends up in
routing, and once a route owns a query the navigation cannot be restructured
without touching behavior.

**Incorrect (the route owns the data):**

```tsx
export default async function Page() {
  const things = await db.query.things.findMany();
  return <ThingsList things={things} />;
}
```

**Correct (the route renders one thing):**

```tsx
export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<ThingsSkeleton />}>
      <ThingsView />
    </Suspense>
  );
}
```

**Tripwire:** A database call, or an `await` that is not `params` or
`searchParams`, means it is in the wrong file.

**Enforced by:** review only. Intent is not something a linter can see.
