# Alien Middleware Changes

`alien-middleware` is the first package to migrate. `rouzer` cannot be cleanly
converted until this package owns a non-Hattip request context contract.

## Dependencies

Change `../alien-middleware/package.json`:

- Remove `@hattip/core` from `peerDependencies`.
- Remove `@hattip/core` from `devDependencies`.
- Add Nitro only if the public package exports Nitro helpers or types directly.
  If possible, keep the core package Web-standard and place Nitro-specific
  helpers behind a subpath export so plain `Request`/`Response` usage does not
  require Nitro.

Suggested exports:

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./nitro": {
    "types": "./dist/nitro.d.ts",
    "default": "./dist/nitro.js"
  },
  "./router": {
    "types": "./dist/router.d.ts",
    "default": "./dist/router.js"
  }
}
```

## Context model

Replace the Hattip-derived context with a package-owned context.

Current public surface:

```ts
export interface HattipContext<
  TPlatform,
  TEnv extends object,
> extends AdapterRequestContext<TPlatform> {
  env: EnvAccessor<TEnv>
  passThrough(): never
  url: URL
  setHeader(name: string, value: string): void
  onResponse(callback: ResponseCallback): void
}
```

Proposed public surface:

```ts
export interface RequestHost<TPlatform = unknown> {
  ip?: string
  platform?: TPlatform
  waitUntil?(promise: Promise<unknown>): void
  passThrough?(): void
  env?(variable: string): string | undefined
}

export interface WebRequestContext<TPlatform, TEnv extends object> {
  request: Request
  host: RequestHost<TPlatform>
  env: EnvAccessor<TEnv>
  passThrough(): never
  waitUntil(promise: Promise<unknown>): void
  url: URL
  setHeader(name: string, value: string): void
  onResponse(callback: ResponseCallback): void
}
```

Notes:

- Keep a deprecated `platform` alias only if preserving source compatibility is
  worth the temporary surface area. Otherwise update callers to use
  `context.host.platform`.
- Keep `passThrough()` as alien-middleware's chain escape hatch, but define its
  behavior in package terms. In Nitro middleware/handlers, returning `undefined`
  continues the Nitro lifecycle; for a final fetch-like handler, unresolved
  requests should still become `404`.
- Keep `waitUntil()` because Nitro events support it, and the README already
  recommends it for non-blocking response callbacks.
- Rename `HattipContext` to something neutral such as `WebRequestContext` or
  `MiddlewareRequestContext`. Consider a deprecated type alias for one major
  version if the package needs a softer break.

## Handler type

Replace `RequestHandler extends HattipHandler<T['platform']>` with a package
handler type.

```ts
export interface RequestHandler<
  T extends MiddlewareTypes = any,
> extends MiddlewareChain<T> {
  (context: RequestContext<any, any, T['platform']>): Awaitable<Response>
}
```

If a plain Web entry helper is added, use a separate fetch-style type:

```ts
export type FetchHandler = (request: Request) => Response | Promise<Response>
```

## Runtime changes

Update `src/index.ts`:

- Replace `AdapterRequestContext` imports with local context types.
- Introduce a small context factory for `Request` plus optional host data.
- Make `runMiddlewareChain` accept the package-owned internal context.
- Preserve response-header cloning and response callback semantics.
- Preserve middleware deduplication and isolated-chain behavior.
- Preserve the default `404` behavior for final handlers.

The existing `defineParsedURL(context)` helper can remain, since it only needs
`context.request.url`.

## Nitro adapter

Add `src/nitro.ts` only if the package should expose first-class Nitro helpers.
It should wrap a chain in a Nitro event handler rather than require consumers to
manually construct the context.

Sketch:

```ts
import { defineHandler, type H3Event } from 'nitro'
import type { RequestHandler } from './types'

export function toNitroHandler(handler: RequestHandler) {
  return defineHandler(event => {
    return handler(createContextFromNitroEvent(event))
  })
}

export function createContextFromNitroEvent(event: H3Event) {
  return createContext({
    request: event.req,
    host: {
      waitUntil: promise => event.waitUntil(promise),
      platform: event.context,
    },
  })
}
```

Validate the exact event request property against installed Nitro types during
implementation. The Nitro docs use `event.req.url` in plugin examples and
describe route handlers as receiving an H3 event.

## Router subpath

Update `src/router.ts` and `src/types.ts`:

- Change `Router(context: AdapterRequestContext<Platform<T>>)` to accept the new
  `RequestContext` or a narrower internal context type.
- Keep `routes()` behavior unchanged. It already uses the Web `Request` URL and
  does not depend on Hattip-specific routing.

## Platform filtering

Update `filterPlatform`:

- Prefer `ctx.host.platform` over `ctx.platform`.
- Decide whether mismatched platforms should call package `passThrough()` or
  simply return `undefined` in Nitro middleware contexts. For compatibility with
  current behavior, keep `passThrough()` so a final handler returns the default
  `404` and an isolated chain lets the outer chain continue.

## Tests

Replace Hattip test contexts with local helpers:

```ts
function createTestContext(request = new Request('http://localhost')) {
  return createContext({
    request,
    host: {
      env: () => undefined,
      platform: {},
      waitUntil: noop,
      passThrough: noop,
    },
  })
}
```

Add adapter tests for:

- `toNitroHandler` returning a Nitro-compatible handler.
- `event.waitUntil` plumbing.
- `event.context` or selected Nitro platform data appearing under
  `context.host.platform`.
- Plain Web `fetch` usage if a fetch adapter is exported.

## Documentation

Update `readme.md`:

- Replace Hattip adapter setup with Nitro setup.
- Explain `chain()` can run as a Nitro handler via the adapter.
- Update "No vendor lock-in" language to say Web APIs plus Nitro deployment
  presets, rather than Hattip adapters.
- Rename "Safe Environment Variables" wording away from Hattip.
- Document `context.host.platform` as an escape hatch and discourage portable
  middleware from relying on it.
