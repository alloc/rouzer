# Nitro Migration Overview

This file set identifies the changes needed to move `rouzer` and
`../alien-middleware` from Hattip to Nitro as the underlying HTTP framework.

## Current coupling

`alien-middleware` is the package with the hard framework contract:

- `src/index.ts` imports `AdapterRequestContext` from `@hattip/core` and runs
  every middleware chain against that context shape.
- `src/types.ts` exports `HattipContext`, `RequestContext`, and `RequestHandler`
  types that extend Hattip's `AdapterRequestContext` and `HattipHandler`.
- `src/middleware/filterPlatform.ts` depends on the Hattip-style
  `context.platform` field and `context.passThrough()`.
- Tests construct Hattip contexts directly.
- The README advertises Hattip adapters as the execution model.

`rouzer` inherits most of that contract through `alien-middleware`:

- `src/server/router.ts` imports `AdapterRequestContext` and `HattipHandler`
  from `@hattip/core`.
- `Router` extends both `HattipHandler<T['platform']>` and
  `MiddlewareChain<T>`.
- Tests use `@hattip/adapter-test` to turn a handler into `fetch`.
- Examples construct tiny Hattip contexts.
- README and docs describe `createRouter()` as Hattip-compatible.

## Nitro target model

The current Nitro docs describe Nitro v3 beta. The npm `nitro` package currently
resolves to `3.0.260610-beta`, so the implementation plan should either accept a
beta framework dependency or wait for a stable Nitro v3 release before merging
the code migration.

Nitro offers two relevant integration shapes:

- A Web-compatible server entry exporting `fetch(request: Request)`.
- A Nitro event handler via `defineHandler(event)`, where the event exposes
  request data, `event.context`, `event.waitUntil`, hooks, middleware, and route
  matching.

The best migration target for these libraries is not Nitro file-system routing
as the primary router. `rouzer` already owns route declarations, runtime
validation, and typed clients. The smaller and more compatible migration is to
make `alien-middleware` and `rouzer` expose Nitro-compatible handlers while
preserving their existing route-tree API.

## Recommended direction

Use Nitro's event handler contract as the canonical server-side integration and
provide a Web `fetch` adapter for direct server-entry usage.

That means:

- `alien-middleware` should stop exporting Hattip-named context types.
- The internal context should be a package-owned Web request context that can be
  constructed from either a Nitro event or a plain `Request`.
- Nitro-specific fields should be accessed through a neutral extension point,
  not through Hattip's `platform`.
- `rouzer.createRouter()` should return the same chainable router shape, but its
  callable signature should target the new `alien-middleware` handler type.
- A Nitro adapter/helper can wrap the router with `defineHandler(...)` for
  Nitro route files, programmatic handlers, middleware entries, or `server.ts`.

## Non-goals

- Do not rewrite Rouzer route trees into Nitro's file-system route layout.
- Do not replace Rouzer's route matching and validation with Nitro/h3 routing.
- Do not introduce a hard dependency on Node-specific Nitro behavior.
- Do not keep Hattip as a transitive compatibility layer if the goal is to use
  Nitro instead of Hattip.

## References

- Nitro introduction: https://nitro.build/docs
- Nitro server entry: https://nitro.build/docs/server-entry
- Nitro routing, middleware, and programmatic handlers:
  https://nitro.build/docs/routing
- Nitro configuration and runtime config:
  https://nitro.build/docs/configuration
- Nitro plugins and request/response hooks: https://nitro.build/docs/plugins
