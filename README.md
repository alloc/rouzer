# Rouzer

Rouzer lets you declare a route once and share its TypeScript types and Zod
validation between a Hattip-compatible server and a typed fetch client.

Rouzer is ESM-only and expects Zod v4 or newer.

## Installation

```sh
pnpm add rouzer zod
```

Import the public API from the root package:

```ts
import { $type, chain, createClient, createRouter, route } from 'rouzer'
```

`chain` is re-exported from `alien-middleware` for typed server middleware.

## Quick example

```ts
import * as z from 'zod'
import { $type, createClient, createRouter, route } from 'rouzer'

export const helloRoute = route('hello/:name', {
  GET: {
    query: z.object({
      excited: z.optional(z.boolean()),
    }),
    response: $type<{ message: string }>(),
  },
})

export const routes = { helloRoute }

export const handler = createRouter({ basePath: 'api/' }).use(routes, {
  helloRoute: {
    GET(ctx) {
      return {
        message: `Hello, ${ctx.path.name}${ctx.query.excited ? '!' : '.'}`,
      }
    },
  },
})

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

const { message } = await client.helloRoute.GET({
  path: { name: 'world' },
  query: { excited: true },
})
```

`handler` can be mounted with any Hattip adapter. Client calls validate route
arguments before `fetch`; server handlers validate matched path, query, headers,
and JSON bodies before your handler runs.

## Documentation

- [Concepts and API selection](docs/context.md)
- [Runnable shared-route example](examples/basic-usage.ts)
- Generated declarations in the published package provide the exact signatures
  for every public export.
- Public TSDoc in `src/` owns symbol-level behavior and option details.
