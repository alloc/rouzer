# Rouzer

Rouzer lets you declare an HTTP route tree once and share its TypeScript types
and Zod validation between a Hattip-compatible server and a typed fetch client.
The client is always created from that route tree.

## What it does

A Rouzer HTTP route tree defines URL patterns, named actions, method schemas, and
optional JSON, error, or newline-delimited JSON response types once, then reuses
that contract to:

- validate client arguments before `fetch`
- match and validate server requests before handlers run
- type handler context from path, query/body, headers, and middleware
- attach typed client action functions such as `client.profiles.get(...)`
- parse typed JSON responses, declared error responses, and NDJSON streams

Rouzer optimizes for shared TypeScript route modules over language-agnostic API
schemas or generated SDKs.

## Is this for you?

Use Rouzer if:

- your server and client can import the same TypeScript route tree
- you want Zod request validation on both sides of an HTTP boundary
- response data is validated at data/client boundaries, not by re-checking every
  handler return
- a Hattip-compatible handler fits your server runtime
- you prefer named resource/action functions over a generated client class

Consider something else if:

- you need OpenAPI-first workflows, schema files, or generated clients for other
  languages
- you want the router to validate every response body at the server boundary;
  `$type<T>()`, `$error<T>()`, and `ndjson.$type<T>()` are type contracts
- you want a framework that owns controllers, data loading, rendering, and
  deployment adapters
- you cannot use ESM or Zod v4+

## Requirements

- ESM runtime and tooling
- Zod v4 or newer
- a Hattip adapter when using `createRouter(...)`
- a Fetch API implementation when using `createClient(...)`
- an absolute `baseURL` and shared `routes` tree for generated client URLs

## Installation

```sh
pnpm add rouzer zod
```

Import the primary API from the root package and declare routes through the HTTP
subpath:

```ts
import { $error, $type, chain, createClient, createRouter } from 'rouzer'
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

`handler` can be mounted with any Hattip adapter. Generated client action calls
validate route arguments before `fetch`; server handlers validate matched path,
query, headers, and JSON bodies before your handler runs.

### Typed status responses

Use a response map when client code needs declared error statuses as data instead
of exceptions.

```ts
import { $error, $type, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

type User = { id: string; name: string }
type NotFound = { code: 'NOT_FOUND'; message: string }

export const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    404: $error<NotFound>(),
  },
})
export const routes = { getUser }

createRouter().use(routes, {
  getUser(ctx) {
    if (ctx.path.id === 'missing') {
      return ctx.error(404, {
        code: 'NOT_FOUND',
        message: 'User not found',
      })
    }
    return { id: ctx.path.id, name: 'Ada' }
  },
})

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

const [error, user, status] = await client.getUser({ path: { id: '42' } })
```

Success entries resolve as `[null, value, status]`; declared error entries
resolve as `[error, null, status]`.

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

- [Concepts, API selection, and v2->v3 migration notes](docs/context.md)
- [Runnable shared-route example](examples/basic-usage.ts)
- [Runnable typed error response example](examples/error-responses.ts)
- [Runnable NDJSON response-stream example](examples/ndjson-stream.ts)
- Generated declarations in the published package provide the exact signatures
  for every public export, including the `rouzer/http` and `rouzer/ndjson`
  subpaths.
- Public TSDoc in `src/` owns symbol-level behavior and option details.
