# srvx Migration Overview

This file set identifies the changes needed to move `rouzer` and
`../alien-middleware` from Hattip to srvx as the underlying HTTP server layer.

## Current coupling

`alien-middleware` owns the hard Hattip dependency:

- `src/index.ts` imports `AdapterRequestContext` from `@hattip/core`.
- `src/types.ts` exports Hattip-derived `HattipContext`, `RequestContext`, and
  `RequestHandler` types.
- `RequestHandler` extends `HattipHandler<T['platform']>`.
- Tests construct `AdapterRequestContext` objects.
- README examples tell users to mount chains through Hattip adapters.

`rouzer` inherits that contract:

- `src/server/router.ts` imports `AdapterRequestContext` and `HattipHandler`.
- `Router<T>` extends `HattipHandler<T['platform']>`.
- Tests use `@hattip/adapter-test`.
- Examples and docs describe the router as Hattip-compatible.

## srvx target model

srvx is a universal server built around Web-standard `fetch`, `Request`, and
`Response` APIs. Its primary handler shape is:

```ts
export default {
  fetch(request: Request) {
    return new Response('ok')
  },
}
```

Programmatic usage uses `serve({ fetch })`. The request may be typed as srvx
`ServerRequest`, which extends `Request` with host/runtime details:

- `request.ip`
- `request.waitUntil(promise)`
- `request.runtime?.name`
- `request.runtime?.node`, `request.runtime?.bun`, `request.runtime?.deno`

srvx also provides server-level middleware and plugins, but `alien-middleware`
already owns a typed middleware chain. Treat srvx middleware as an optional
outer integration point, not as a replacement for alien-middleware.

## Recommended direction

Use a package-owned Web request context and expose srvx-compatible fetch helpers.

That means:

- `alien-middleware` should stop extending Hattip context and handler types.
- The core handler should be callable with a package-owned context constructed
  from a Web `Request`.
- Add a helper that adapts a chain to `fetch(request)`, preserving srvx
  `ServerRequest` metadata under a neutral host field.
- `rouzer.createRouter()` should continue returning the same chainable router,
  but its callable signature should target the new `alien-middleware` handler
  type.
- App examples should show `serve({ fetch: toFetchHandler(router) })`.

## Why not srvx middleware as the core

srvx middleware has a `(request, next) => response` shape. That is useful at the
server boundary, but it does not replace alien-middleware's type-level behavior:

- Alien middleware infers downstream context properties from returned plugins.
- Alien middleware supports isolated chains.
- Alien middleware deduplicates request middleware.
- Rouzer handler context depends on alien-middleware's typed context flow.

So the migration should adapt alien-middleware to srvx, not rewrite
alien-middleware in srvx middleware terms.

## References

- srvx guide: https://srvx.h3.dev/guide
- Fetch handler and `ServerRequest`: https://srvx.h3.dev/guide/handler
- Middleware and plugins: https://srvx.h3.dev/guide/middleware
- Server lifecycle: https://srvx.h3.dev/guide/server
- Server options: https://srvx.h3.dev/guide/options
- Bundler usage: https://srvx.h3.dev/guide/bundler
- Node.js support: https://srvx.h3.dev/guide/node
- AWS Lambda adapter: https://srvx.h3.dev/guide/aws-lambda
- CLI usage: https://srvx.h3.dev/guide/cli
