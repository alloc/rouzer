# Middleware and request context

Rouzer includes request context and middleware composition in its root API, so
most applications can import route, middleware, and adapter helpers from one
package.

```ts
import {
  chain,
  filterRuntime,
  type Middleware,
  type MiddlewareContext,
  type RequestContext,
  type RequestHandler,
} from 'rouzer'
```

## Middleware Chain

`chain()` creates a `MiddlewareChain`. Rouzer routers are middleware chains too,
so you can append middleware before attaching routes.

```ts
const requestInfo = chain().use(ctx => ({
  requestId: ctx.request.headers.get('x-request-id') ?? crypto.randomUUID(),
}))

const router = createRouter()
  .use(requestInfo)
  .use(routes, {
    getProfile(ctx) {
      return loadProfile(ctx.path.id, ctx.requestId)
    },
  })
```

Middleware runs in order. A middleware can:

- return `void` or `undefined` to continue without adding context
- return a `Response` to stop the chain and send that response
- return a request plugin object whose properties are merged into the downstream
  context
- call `ctx.passThrough()` to skip the rest of the current chain

## Request Context

Every middleware and Rouzer handler receives a `RequestContext`.

| Property                     | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `ctx.request`                | The Web `Request`.                                                            |
| `ctx.url`                    | Lazily parsed `URL` for `ctx.request.url`.                                    |
| `ctx.host`                   | Host data such as `ip`, `runtime`, `env`, and `waitUntil`.                    |
| `ctx.env(name)`              | Typed environment lookup backed by `ctx.host.env` and middleware env plugins. |
| `ctx.waitUntil(promise)`     | Delegates background work to `ctx.host.waitUntil` when available.             |
| `ctx.setHeader(name, value)` | Sets a response header from request middleware.                               |
| `ctx.onResponse(callback)`   | Registers a callback that can mutate or replace the final response.           |
| `ctx.passThrough()`          | Chain-local control flow for unresolved requests.                             |

Host-provided values live under `ctx.host`.

```ts
const runtimeName = ctx.host.runtime?.name
const ip = ctx.host.ip
```

Runtime-specific request data should stay behind `ctx.host.runtime`.

## Adding Context Properties

Return a plain object to make properties available to downstream middleware and
handlers.

```ts
const sessionMiddleware = chain().use(async ctx => {
  const token = ctx.request.headers.get('authorization')
  const session = token ? await readSession(token) : null

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  return { session }
})
```

Attach the middleware before route handlers that need the property.

```ts
createRouter()
  .use(sessionMiddleware)
  .use(routes, {
    me(ctx) {
      return ctx.session.user
    },
  })
```

Treat context property names as owned by the middleware that introduces them.
Avoid collisions between unrelated middleware.

## Environment Bindings

Return an `env` object to add typed variables behind `ctx.env(...)`.

```ts
const envMiddleware = chain().use(() => ({
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
}))

const router = createRouter()
  .use(envMiddleware)
  .use(routes, {
    health(ctx) {
      return { configured: Boolean(ctx.env('DATABASE_URL')) }
    },
  })
```

The `env` key is reserved for environment bindings. Values are accessed through
`ctx.env(name)`, not as `ctx.env.DATABASE_URL`.

## Runtime Type Markers

The `runtime` request plugin key is reserved as a type-level marker for
`ctx.host.runtime`; it does not add `ctx.runtime`.

```ts
const nodeOnly = chain()
  .use(filterRuntime<{ name: 'node' }>('node'))
  .use(ctx => {
    ctx.host.runtime?.name
  })
```

`filterRuntime(name)` checks `ctx.host.runtime?.name`. If the runtime name does
not match, it calls `ctx.passThrough()`.

## Response Callbacks

Use `ctx.onResponse(callback)` or return `{ onResponse }` when middleware needs
to finalize a response after a route handler runs.

```ts
const timing = chain().use(ctx => {
  const startedAt = Date.now()

  ctx.onResponse(response => {
    response.headers.set('server-timing', `app;dur=${Date.now() - startedAt}`)
  })
})
```

Use `ctx.setHeader(name, value)` from request middleware for simple headers.
Inside response callbacks, mutate `response.headers` directly or return a new
`Response`.

## Isolation

Use `.isolate()` when you want to run a chain for side effects or early
responses without leaking its plugin properties into the parent chain.

```ts
const optionalAuth = chain()
  .use(readOptionalSession)
  .use(auditSession)
  .isolate()

const router = createRouter().use(optionalAuth).use(routes, handlers)
```

An isolated chain can still return a `Response`. Its context additions stay
inside the isolated chain.

## Pass Through

`ctx.passThrough()` is chain-local control flow. In a nested or isolated chain,
it skips the rest of that chain and lets the parent chain continue. In a final
fetch handler, an unresolved request becomes the default `404 Not Found`
response.

Use `passThrough` for optional middleware branches or runtime filters. Use a
`Response` when you want to deliberately stop the request.
