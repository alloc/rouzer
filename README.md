# Rouzer

Rouzer lets you declare an HTTP route tree once and share its TypeScript types
and Zod validation between a Hattip-compatible server and a typed fetch client.

## What it does

A Rouzer HTTP route tree defines URL patterns, named actions, method schemas, and
optional JSON or newline-delimited JSON response types once, then reuses that
contract to:

- validate client arguments before `fetch`
- match and validate server requests before handlers run
- type handler context from path, query/body, headers, and middleware
- attach typed client action functions such as `client.profiles.get(...)`
- parse typed JSON responses and typed NDJSON response streams

Rouzer optimizes for shared TypeScript route modules over language-agnostic API
schemas or generated SDKs.

## Is this for you?

Use Rouzer if:

- your server and client can import the same TypeScript route tree
- you want Zod request validation on both sides of an HTTP boundary
- a Hattip-compatible handler fits your server runtime
- you prefer named resource/action functions over a generated client class

Consider something else if:

- you need OpenAPI-first workflows, schema files, or generated clients for other
  languages
- you need runtime response-body validation; `response: $type<T>()` and
  `response: ndjson.$type<T>()` are compile-time only
- you want a framework that owns controllers, data loading, rendering, and
  deployment adapters
- you cannot use ESM or Zod v4+

## Requirements

- ESM runtime and tooling
- Zod v4 or newer
- a Hattip adapter when using `createRouter(...)`
- a Fetch API implementation when using `createClient(...)`
- an absolute `baseURL` for generated client URLs

## Installation

```sh
pnpm add rouzer zod
```

Import the primary API from the root package and declare routes through the HTTP
subpath:

```ts
import { $type, chain, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
```

`chain` is re-exported from `alien-middleware` for typed server middleware.

## Quick example

This example shows the core loop: one HTTP action contract defines validation,
server handler types, and the typed client call.

```ts
import * as z from 'zod'
import { $type, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

export const hello = http.get('hello/:name', {
  query: z.object({
    excited: z.optional(z.boolean()),
  }),
  response: $type<{ message: string }>(),
})

export const routes = { hello }

export const handler = createRouter({ basePath: 'api/' }).use(routes, {
  hello(ctx) {
    return {
      message: `Hello, ${ctx.path.name}${ctx.query.excited ? '!' : '.'}`,
    }
  },
})

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

const { message } = await client.hello({
  path: { name: 'world' },
  query: { excited: true },
})
```

`handler` can be mounted with any Hattip adapter. Client action calls validate
route arguments before `fetch`; server handlers validate matched path, query,
headers, and JSON bodies before your handler runs.

### NDJSON response streams

Use `response: ndjson.$type<T>()` for endpoints that stream
newline-delimited JSON. Add `ndjson.routerPlugin` to the router and
`ndjson.clientPlugin` to the client. Handlers return an `Iterable<T>` or
`AsyncIterable<T>`; Rouzer wraps it in an `application/x-ndjson` response.
Client action functions resolve to an `AsyncIterable<T>`.

```ts
import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

export const events = http.get('events', {
  response: ndjson.$type<{ id: number; message: string }>(),
})
export const routes = { events }

createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  async *events() {
    yield { id: 1, message: 'ready' }
  },
})

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
  plugins: [ndjson.clientPlugin],
})
for await (const event of await client.events()) {
  console.log(event.message)
}
```

## Documentation

- [Concepts, API selection, and v2.0.1 migration notes](docs/context.md)
- [Runnable shared-route example](examples/basic-usage.ts)
- Generated declarations in the published package provide the exact signatures
  for every public export, including the `rouzer/http` and `rouzer/ndjson`
  subpaths.
- Public TSDoc in `src/` owns symbol-level behavior and option details.
