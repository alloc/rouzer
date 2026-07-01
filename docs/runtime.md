# Runtime and adapters

Rouzer routers are Alien Middleware request handlers. Use adapter helpers to
turn them into functions accepted by your HTTP server, framework, or tests.

## Plain Fetch Handler

For a plain Web `Request`, use the root `toFetchHandler` re-export.

```ts
import { createRouter, toFetchHandler } from 'rouzer'

const router = createRouter().use(routes, handlers)
const fetchHandler = toFetchHandler(router)

const response = await fetchHandler(new Request('https://example.test/users'))
```

`toFetchHandler(handler)` creates an Alien Middleware request context for each
request and calls the handler.

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

Host runtime data lives under `ctx.host.runtime`. Rouzer and Alien Middleware do
not expose the old Hattip `platform` alias.

## srvx

When mounting in srvx, use Alien Middleware's srvx subpath so srvx
`ServerRequest` metadata is mapped into `context.host`.

```ts
import { serve } from 'srvx'
import { createRouter } from 'rouzer'
import { toFetchHandler } from 'alien-middleware/srvx'

const router = createRouter().use(routes, handlers)

serve({
  port: 3000,
  fetch: toFetchHandler(router),
})
```

The srvx adapter copies `request.ip`, `request.runtime`, and `request.waitUntil`
into the Alien Middleware host shape when those values are available.

Use the root `toFetchHandler` for plain Web `Request` tests and custom adapters.
Use `alien-middleware/srvx` when the incoming request is a srvx `ServerRequest`.

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

Rouzer does not set `Access-Control-Allow-Credentials`; set it yourself when
credentialed requests need it.

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

The root adapter delegates to `host.waitUntil`. The srvx adapter delegates to
`request.waitUntil` when srvx provides it.
