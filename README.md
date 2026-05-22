# Rouzer

Rouzer lets you declare a route once and share its TypeScript types and Zod
validation between a Hattip-compatible server and a typed fetch client.

## What it does

A Rouzer route declaration defines a URL pattern, method schemas, and optional
response type once, then reuses that contract to:

- validate client arguments before `fetch`
- match and validate server requests before handlers run
- type handler context from path, query/body, headers, and middleware
- attach typed client shorthand methods such as `client.helloRoute.GET(...)`

Rouzer optimizes for shared TypeScript route modules over language-agnostic API
schemas or generated SDKs.

## Is this for you?

Use Rouzer if:

- your server and client can import the same TypeScript route declarations
- you want Zod request validation on both sides of an HTTP boundary
- a Hattip-compatible handler fits your server runtime
- you prefer a small routing/client contract over a full web framework

Consider something else if:

- you need OpenAPI-first workflows, schema files, or generated clients for other
  languages
- you need runtime response-body validation; `response: $type<T>()` is
  compile-time only
- you want a framework that owns controllers, data loading, rendering, and
  deployment adapters
- you cannot use ESM or Zod v4+

## Requirements

- ESM runtime and tooling
- Zod v4 or newer
- a Hattip adapter when using `createRouter(...)`
- a Fetch API implementation when using `createClient(...)`
- an absolute `baseURL` for pathname route patterns with the current client
  implementation

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

This example shows the core loop: one route contract defines validation, server
handler types, and the typed client call.

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
