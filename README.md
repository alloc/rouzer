# Rouzer

Rouzer is a small TypeScript HTTP framework for projects that can share one
route tree between server and client code. The route tree defines URL patterns,
named actions, request validation, and response contracts once, then Rouzer uses
it to build a fetch-compatible router and a typed fetch client.

Rouzer is built on Alien Middleware. Rouzer owns route contracts, validation,
handler typing, response helpers, and the generated client. Alien Middleware
owns the request context, middleware chain, host/runtime data, background work,
and the adapter helpers that turn a chain into a Fetch API handler.

## Use It When

Use Rouzer when:

- your server and client can import the same TypeScript route module
- you want Zod validation before client requests and before server handlers
- a fetch-compatible handler fits your runtime or adapter
- named resource/action calls are a better fit than generated SDK classes

Consider another tool when you need OpenAPI-first schemas, generated clients for
other languages, server-side response validation for every handler return, or a
framework that owns rendering, deployment, and data loading.

## Install

```sh
pnpm add rouzer zod
```

Rouzer requires ESM, Zod v4 or newer, a Fetch API implementation for clients,
and a fetch-compatible server or adapter for routers.

```ts
import {
  $error,
  $type,
  chain,
  createClient,
  createRouter,
  metadata,
  toFetchHandler,
} from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'
```

`chain`, `toFetchHandler`, request context types, and related middleware helpers
are re-exported from Alien Middleware for the common Rouzer path.

## Small Example

```ts
import * as z from 'zod'
import {
  $type,
  chain,
  createClient,
  createRouter,
  toFetchHandler,
} from 'rouzer'
import * as http from 'rouzer/http'

type Profile = {
  id: string
  name: string
  requestId: string
}

export const profiles = http.resource('profiles/:id', {
  get: http.get({
    query: z.object({
      includePosts: z.optional(z.boolean()),
    }),
    response: $type<Profile>(),
  }),
})

export const routes = { profiles }

const requestInfo = chain().use(ctx => ({
  requestId: ctx.request.headers.get('x-request-id') ?? 'local',
}))

const router = createRouter({ basePath: 'api/' })
  .use(requestInfo)
  .use(routes, {
    profiles: {
      get(ctx) {
        return {
          id: ctx.path.id,
          name: 'Ada',
          requestId: ctx.requestId,
        }
      },
    },
  })

const fetchHandler = toFetchHandler(router)

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

const profile = await client.profiles.get(
  { id: '42', includePosts: false },
  { headers: { 'x-request-id': 'docs' } }
)
```

The shared `routes` object drives the handler map and the generated client. The
middleware output becomes part of the handler context, while the route schema
adds typed `ctx.path`, `ctx.query`, `ctx.body`, and `ctx.headers` values.

## Core Concepts

Route contracts live in shared TypeScript modules. Use `rouzer/http` resources
for path-scoped namespaces and actions such as `http.get`, `http.post`, and
`http.patch` for concrete HTTP operations.

Routers are Alien Middleware request handlers. `createRouter()` returns a
chainable handler; `.use(middleware)` appends middleware and `.use(routes,
handlers)` attaches a route tree.

Handlers mirror the route tree. Rouzer validates the matched request before the
handler runs, then lets the handler return JSON data, a custom `Response`,
declared status helpers, or a response-plugin value such as an NDJSON stream.

Clients mirror the same route tree. `createClient({ baseURL, routes })` returns
typed action functions with flat route input objects and optional per-request
`RequestInit` options.

Response markers are type contracts. `$type<T>()`, `$error<T>()`, and
`ndjson.$type<T>()` shape handler and client types, but they do not re-validate
handler return values at the server boundary.

## Documentation

- [Documentation map](docs/index.md)
- [Framework concepts](docs/concepts.md)
- [Route contracts](docs/routes.md)
- [Middleware and request context](docs/middleware.md)
- [Routers and handlers](docs/handlers.md)
- [Typed client](docs/client.md)
- [Responses, errors, and plugins](docs/responses.md)
- [NDJSON streaming](docs/streaming.md)
- [Runtime and adapters](docs/runtime.md)
- [Patterns, constraints, and migrations](docs/patterns.md)

Runnable examples:

- [Basic shared-route example](examples/basic-usage.ts)
- [Typed status response example](examples/error-responses.ts)
- [NDJSON response-stream example](examples/ndjson-stream.ts)

Published declarations provide exact signatures for every public export,
including the `rouzer/http` and `rouzer/ndjson` subpaths. Public TSDoc in `src/`
owns symbol-level behavior and option details.
