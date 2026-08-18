---
title: Server and client code live in named folders
impact: CRITICAL
impactDescription: Stops secrets and database access reaching the browser bundle
paths:
  - 'src/features/**'
  - 'src/lib/**'
tags: architecture, security, boundary
---

## Server and client code live in named folders

Anything touching a database, a secret, or an API key lives in
`features/<f>/server/` and starts with `import 'server-only'`. Anything touching
`window`, `indexedDB`, or `localStorage` lives in `features/<f>/local/` and
starts with `import 'client-only'`.

Without the import, a module that reads a connection string can be pulled into a
client component through any chain of re-exports and shipped to the browser. With
it, that is a build error naming the offending chain.

**Incorrect (a query with no guard, importable from anywhere):**

```ts
// features/things/queries.ts
import { db } from '@/lib/db/client';

export const getThings = () => db.query.things.findMany();
```

**Correct (in server/, guarded on the first line):**

```ts
// features/things/server/queries.ts
import 'server-only';

import { db } from '@/lib/db/client';

export async function getThings() {
  return db.query.things.findMany();
}
```

**Tripwire:** Does this file read a secret, the database, or a browser API? Then
it belongs in `server/` or `local/`, and its first line says which.

**Enforced by:** bundler — plus a CI grep asserting every `features/*/server/`
file opens with the import, which fails with a better message than the bundler's.
