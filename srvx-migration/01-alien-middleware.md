# Alien Middleware Changes

`alien-middleware` should become independent of Hattip and expose a fetch-style
adapter that works directly with srvx.

## Dependencies

Change `../alien-middleware/package.json`:

- Remove `@hattip/core` from `peerDependencies`.
- Remove `@hattip/core` from `devDependencies`.
- Add `srvx` as a development dependency if tests or public helpers import srvx
  types.
- Keep the root package Web-standard if possible. If srvx types are only needed
  for helpers, export them from a separate subpath such as
  `alien-middleware/srvx`.

Suggested export shape:

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./srvx": {
    "types": "./dist/srvx.d.ts",
    "default": "./dist/srvx.js"
  },
  "./router": {
    "types": "./dist/router.d.ts",
    "default": "./dist/router.js"
  }
}
```

## Context model

Replace the Hattip-derived context with a package-owned context.

Proposed shape:

```ts
export interface RequestHost<TPlatform = unknown> {
  ip?: string
  runtime?: TPlatform
  waitUntil?(promise: Promise<unknown>): void
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

Mapping from srvx:

- `request` is the incoming `Request` or `ServerRequest`.
- `host.ip` comes from `request.ip`.
- `host.runtime` comes from `request.runtime`.
- `waitUntil` delegates to `request.waitUntil`.
- `env` should remain alien-middleware's typed accessor. srvx does not define a
  Hattip-style `env(variable)` API, so provide this through adapter options or a
  default `process.env` lookup where that is acceptable.

Keep a deprecated `platform` alias only if compatibility is required. For srvx,
`runtime` is the more accurate name.

## Handler and fetch adapter

Replace `RequestHandler extends HattipHandler<T['platform']>` with a local
handler type:

```ts
export interface RequestHandler<
  T extends MiddlewareTypes = any,
> extends MiddlewareChain<T> {
  (context: RequestContext<any, any, T['platform']>): Awaitable<Response>
}
```

Add a fetch adapter:

```ts
export function toFetchHandler(handler: RequestHandler): typeof fetch {
  return request => handler(createContextFromRequest(request))
}
```

If this lives in `alien-middleware/srvx`, type the input as srvx
`ServerRequest`:

```ts
import type { ServerRequest } from 'srvx'

export function createContextFromServerRequest(request: ServerRequest) {
  return createContext({
    request,
    host: {
      ip: request.ip,
      runtime: request.runtime,
      waitUntil: promise => request.waitUntil?.(promise),
    },
  })
}
```

## `passThrough()` semantics

Hattip `passThrough()` asks the adapter to let another handler process the
request. srvx fetch handlers must return a `Response`, and srvx middleware
continues by calling `next()`.

Define alien-middleware `passThrough()` as chain-local control flow:

- In an isolated chain, it skips the rest of the isolated chain and lets the
  parent chain continue.
- In a final fetch handler, unresolved requests become the existing default
  `404` response.
- If a srvx middleware adapter is added later, `passThrough()` can map to
  `next()` at that boundary.

This preserves current behavior without pretending srvx has the same adapter
contract as Hattip.

## Runtime changes

Update `src/index.ts`:

- Replace `AdapterRequestContext` with local internal context types.
- Add `createContext({ request, host })`.
- Make `runMiddlewareChain` operate on the local context.
- Keep response callback behavior, response cloning, deduplication, isolated
  chains, and default `404` behavior unchanged.
- Keep `defineParsedURL(context)` unchanged.

Update `src/types.ts`:

- Rename `HattipContext` to a neutral name such as `WebRequestContext`.
- Export `RequestHost`.
- Update `RequestHandler`.
- Update `Router` callable types that currently take `AdapterRequestContext`.

Update `src/middleware/filterPlatform.ts`:

- Prefer `ctx.host.runtime?.name` or a caller-provided predicate.
- Consider renaming the helper to `filterRuntime`, with `filterPlatform` kept as
  a compatibility alias if needed.

## Tests

Replace Hattip contexts with local request contexts:

```ts
function createTestContext(request = new Request('http://localhost/')) {
  return createContext({
    request,
    host: {
      ip: '',
      runtime: { name: 'test' },
      waitUntil: noop,
      env: () => undefined,
    },
  })
}
```

Add tests for:

- `toFetchHandler` accepting a plain `Request`.
- `createContextFromServerRequest` copying `ip`, `runtime`, and `waitUntil`.
- `waitUntil` delegation.
- `filterRuntime` or updated `filterPlatform` behavior.
- Current middleware chain behavior remaining unchanged.

## Documentation

Update `readme.md`:

- Replace Hattip adapter examples with srvx examples.
- Show `serve({ fetch: toFetchHandler(app) })`.
- Explain that middleware still uses Web `Request` and `Response`.
- Update no-vendor-lock-in wording to cite Web APIs and srvx runtime support for
  Node.js, Bun, and Deno.
- Document `context.host.runtime` as runtime-specific escape hatch data.
