# Runtime and adapters

> Adapt a Rouzer request handler to a Fetch runtime while keeping host-specific
> data behind the request context boundary.

Rouzer routers are request handlers. Use adapter helpers to turn them into
functions accepted by your HTTP server, framework, or tests.

## Plain Fetch Handler

For a plain Web `Request`, use the root `toFetchHandler` re-export.

```ts
import { createRouter, toFetchHandler } from 'rouzer'

const router = createRouter().use(routes, handlers)
const fetchHandler = toFetchHandler(router)

const response = await fetchHandler(new Request('https://example.test/users'))
```

`toFetchHandler(handler)` creates a Rouzer request context for each request and
calls the handler.

## Host Data

Pass host data when middleware or handlers need environment variables, runtime
metadata, client IP, or background work support.

```ts
const fetchHandler = toFetchHandler(router, {
  host: request => ({
    ip: request.headers.get('x-forwarded-for') ?? undefined,
    runtime: { name: 'custom' },
    env: name => process.env[name],
    waitUntil: promise => {
      void promise
    },
  }),
})
```

Handlers read that data from the request context:

```ts
ctx.host.ip
ctx.host.runtime?.name
ctx.env('DATABASE_URL')
ctx.waitUntil(writeAuditLog())
```

Host runtime data lives under `ctx.host.runtime`.

## Fetch-Compatible Servers

Many servers and frameworks accept a function that receives a Web `Request` and
returns a `Response`. Mount `toFetchHandler(router)` in those environments.

```ts
const router = createRouter().use(routes, handlers)
const fetch = toFetchHandler(router)
```

If the server exposes extra request metadata, pass it through the `host` option
so middleware and handlers can read it from `ctx.host`.

## Custom Contexts

Use `createContext` when writing custom adapters or tests that call a handler
directly.

```ts
import { createContext } from 'rouzer'

const context = createContext({
  request: new Request('https://example.test/api/health'),
  host: {
    runtime: { name: 'test' },
    env: name => process.env[name],
  },
})

const response = await router(context)
```

Most tests should prefer a local fetch wrapper because it exercises URL
construction and request creation through the client.

```ts
import { toFetchHandler, type RequestHandler } from 'rouzer'

function createLocalFetch(handler: RequestHandler): typeof fetch {
  const fetchHandler = toFetchHandler(handler)
  return (input, init) => fetchHandler(new Request(input, init))
}
```

## CORS

Rouzer can restrict requests with an `Origin` header through router config.

```ts
createRouter({
  cors: {
    allowOrigins: [
      'example.net',
      'https://*.example.com',
      '*://localhost:3000',
    ],
  },
})
```

Origins may contain wildcard protocol and subdomain segments. Origins without a
protocol default to `https`.

For allowed non-preflight requests, Rouzer sets
`Access-Control-Allow-Origin`. For preflight requests, Rouzer returns
`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and
`Access-Control-Allow-Headers`.

> [!WARNING]
> Rouzer does not set `Access-Control-Allow-Credentials`. Set it yourself before
> relying on credentialed cross-origin requests.

## Background Work

Use `ctx.waitUntil(promise)` in middleware or handlers when the host supports
background work.

```ts
ctx.waitUntil(
  writeAuditLog({
    route: ctx.url.pathname,
    runtime: ctx.host.runtime?.name,
  })
)
```

The adapter delegates to `host.waitUntil` when you provide it.

> [!NOTE]
> Without `host.waitUntil`, the request context has no runtime-specific lifetime
> extension to delegate to. Provide it when background work must outlive the
> response.
