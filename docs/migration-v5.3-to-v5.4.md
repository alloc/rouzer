# Migrating from v5.3 to v5.4

Rouzer v5.4 moves the server runtime boundary from Hattip-compatible handlers to
fetch-compatible Rouzer handlers. Route declarations, handler maps, generated
clients, response maps, response plugins, raw bodies, and NDJSON routes keep the
same Rouzer shape.

Most applications only need to update server mounting code, tests, and any
explicit Hattip handler/context types.

## Replace Hattip adapters with Fetch handlers

Remove Hattip packages that were used only to mount Rouzer handlers.

```sh
pnpm remove @hattip/core @hattip/adapter-node @hattip/adapter-test
pnpm add rouzer zod
```

Use Rouzer's root `toFetchHandler` helper when a server or test harness expects
a function that receives a Web `Request` and returns a `Response`.

```ts
import { createRouter, toFetchHandler } from 'rouzer'

const router = createRouter({ basePath: 'api/' }).use(routes, handlers)

export const fetch = toFetchHandler(router)
```

If your server already accepts a Fetch API handler, mount `fetch` directly. If
your server exposes host metadata such as client IP, runtime data, environment
lookups, or background work, pass it through `toFetchHandler`.

```ts
const fetch = toFetchHandler(router, {
  host: request => ({
    ip: request.headers.get('x-forwarded-for') ?? undefined,
    runtime: { name: 'node' },
    env: name => process.env[name],
    waitUntil: promise => {
      void promise
    },
  }),
})
```

## Replace Hattip types

Rouzer no longer requires Hattip types in application code.

```ts
// v5.3
import type { AdapterRequestContext, HattipHandler } from '@hattip/core'

// v5.4
import type { RequestContext, RequestHandler } from 'rouzer'
```

Rouzer routers are `RequestHandler` values. Middleware and route handlers receive
`RequestContext` plus the route-specific fields that Rouzer infers from your
route tree.

## Update tests

If tests used `@hattip/adapter-test`, replace it with a small local fetch
wrapper.

```ts
// v5.3
import { createTestClient } from '@hattip/adapter-test'

const client = createClient({
  baseURL,
  routes,
  fetch: createTestClient({
    handler,
    baseUrl: baseURL,
  }),
})
```

```ts
// v5.4
import { createClient, toFetchHandler, type RequestHandler } from 'rouzer'

function createLocalFetch(handler: RequestHandler): typeof fetch {
  const fetchHandler = toFetchHandler(handler)
  return (input, init) => fetchHandler(new Request(input, init))
}

const client = createClient({
  baseURL,
  routes,
  fetch: createLocalFetch(handler),
})
```

The wrapper matters because generated clients call `fetch(input, init)`, while a
Rouzer fetch handler receives one `Request`.

## Use `ctx.host` for host data

Host-provided values now live under `ctx.host`.

```ts
const ip = ctx.host.ip
const runtimeName = ctx.host.runtime?.name
```

If old code read adapter-specific fields directly from the context, move those
values behind the `host` option when creating the fetch handler.

```ts
const fetch = toFetchHandler(router, {
  host: request => ({
    ip: request.headers.get('x-forwarded-for') ?? undefined,
    runtime: { name: 'custom' },
  }),
})
```

## Rename runtime filters

If code used the old platform filter helper from Rouzer's root exports, use
`filterRuntime`.

```ts
// v5.3
import { filterPlatform } from 'rouzer'

const middleware = chain().use(filterPlatform('node'))
```

```ts
// v5.4
import { filterRuntime } from 'rouzer'

const middleware = chain().use(filterRuntime<{ name: 'node' }>('node'))
```

`filterRuntime(name)` checks `ctx.host.runtime?.name` and narrows the downstream
runtime type.

## Update custom contexts

If tests or custom adapters constructed request contexts directly, use
`createContext` with a Web `Request` and optional `host` data.

```ts
import { createContext } from 'rouzer'

const context = createContext({
  request: new Request('https://example.test/api/health'),
  host: {
    ip: '127.0.0.1',
    runtime: { name: 'test' },
    env: name => process.env[name],
    waitUntil: promise => {
      void promise
    },
  },
})

const response = await router(context)
```

## Update pass-through assumptions

`ctx.passThrough()` is middleware-chain control flow. It skips the rest of the
current chain and lets the parent chain continue. In a final fetch handler, an
unresolved request becomes Rouzer's default `404 Not Found` response.

Use `ctx.passThrough()` for optional middleware branches and runtime filters.
Return a `Response` when you want to stop the request deliberately.

## What stays the same

These Rouzer APIs keep the same shape:

- `rouzer/http` resources and actions
- `createRouter().use(routes, handlers)` route registration
- middleware added with `.use(middleware)`
- generated clients from `createClient({ baseURL, routes })`
- flat client action input objects
- `$type<T>()`, `$error<T>()`, and response maps
- response plugins such as `ndjson.routerPlugin` and `ndjson.clientPlugin`
- `http.rawBody()` request bodies

## Checklist

1. Remove Hattip packages that were only used for Rouzer serving or tests.
2. Mount routers with `toFetchHandler(router)`.
3. Replace Hattip handler/context types with Rouzer `RequestHandler` and
   `RequestContext`.
4. Replace test adapters with a local fetch wrapper.
5. Move host metadata into the `host` option and read it from `ctx.host`.
6. Replace platform filters with `filterRuntime`.
7. Keep route trees, handler maps, clients, responses, and plugins unchanged
   unless your application code was also changing them.
