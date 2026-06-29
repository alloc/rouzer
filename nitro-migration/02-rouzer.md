# Rouzer Changes

After `alien-middleware` has a non-Hattip context, `rouzer` can migrate with a
smaller surface change.

## Dependencies

Change `package.json`:

- Remove `@hattip/core` from `dependencies`.
- Remove `@hattip/adapter-test` from `devDependencies`.
- Add Nitro as a development dependency if tests import Nitro types or exercise
  Nitro adapters.
- Keep `alien-middleware` as the underlying middleware dependency, but depend on
  the version that contains the new context contract.

If Rouzer exports Nitro helpers directly, add a Nitro subpath:

```json
{
  "./nitro": {
    "types": "./dist/nitro.d.ts",
    "import": "./dist/nitro.js"
  }
}
```

## Router type

Update `src/server/router.ts`:

- Remove `AdapterRequestContext` and `HattipHandler` imports.
- Change `Router<T>` so it extends the new `alien-middleware` `RequestHandler`
  type instead of `HattipHandler<T['platform']>`.
- Remove Hattip wording from comments.

Current shape:

```ts
export interface Router<T extends MiddlewareTypes = any>
  extends HattipHandler<T['platform']>, MiddlewareChain<T> {
  // ...
}
```

Proposed shape:

```ts
export interface Router<T extends MiddlewareTypes = any>
  extends RequestHandler<T>, MiddlewareChain<T> {
  // ...
}
```

The route validation and response encoding logic can stay intact. It already
works from `context.request`, `context.url`, `context.setHeader`, and middleware
context properties supplied by `alien-middleware`.

## Nitro helper

Add a `src/server/nitro.ts` or top-level `src/nitro.ts` helper if Rouzer should
be easy to mount inside Nitro.

Sketch:

```ts
import { toNitroHandler } from 'alien-middleware/nitro'
import type { Router } from './server/router'

export function toNitroRouter(router: Router) {
  return toNitroHandler(router)
}
```

Consumers could then use:

```ts
// server.ts or routes/[...].ts in a Nitro app
import { defineHandler } from 'nitro'
import { createRouter, toNitroRouter } from 'rouzer/nitro'
import { routes } from './routes'

const router = createRouter({ basePath: 'api/' }).use(routes, handlers)

export default toNitroRouter(router)
```

Alternatively, avoid a Rouzer-specific Nitro helper and document the
`alien-middleware/nitro` helper as the canonical adapter.

## Server entry integration

Nitro's `server.ts` can export a Web-compatible object with
`fetch(request: Request)`. If `alien-middleware` exposes a fetch adapter,
Rouzer can also support:

```ts
import { toFetchHandler } from 'alien-middleware'

const router = createRouter().use(routes, handlers)

export default {
  fetch: toFetchHandler(router),
}
```

This is useful for applications that want Rouzer to be the primary router and
let Nitro provide the build/deploy/runtime shell.

## Base path and route matching

Keep Rouzer's current `basePath` behavior.

Nitro route handlers and server entries see full request URLs, so
`createRouter({ basePath: 'api/' })` can continue matching `/api/...`. Avoid
mapping every Rouzer action to Nitro filesystem routes unless there is a later
feature need for Nitro route-level code splitting. Doing so would duplicate
Rouzer's route tree and make the typed client harder to reason about.

## CORS and headers

Rouzer's existing CORS code should continue to live in Rouzer because it is
aware of route schemas and preflight behavior. Nitro route rules have a coarse
`cors: true` shortcut, but that does not replace Rouzer's configured
`allowOrigins` validation.

`context.setHeader()` should continue to be supplied by `alien-middleware`; no
Rouzer-specific header abstraction is needed.

## Tests

Replace `@hattip/adapter-test` usage in:

- `test/fixtures/shared.ts`
- `test/fixtures/server-validation/test.ts`

with one of:

- A local `createTestFetch(handler)` helper that builds the new
  `alien-middleware` test context from a `Request`.
- A Nitro adapter test that calls the Nitro handler directly with a mocked event,
  if the adapter exposes a small context factory.

The local helper is enough for Rouzer's route validation tests because the
tests only need Fetch-compatible request/response behavior.

## Examples and docs

Update:

- `README.md`
- `docs/context.md`
- `examples/basic-usage.ts`
- `examples/error-responses.ts`
- `examples/ndjson-stream.ts`

Replace Hattip adapter examples with Nitro examples:

- For app-style usage, show `server.ts` exporting a Web `fetch` handler.
- For route-file usage, show a catch-all Nitro route exporting a
  `toNitroRouter(createRouter(...))` handler.
- Replace "Hattip-compatible" with "Nitro-compatible" or "Web-compatible",
  depending on the exact helper used.

## Generated dist files

Do not hand-edit `dist`. Once the source migration is implemented, rebuild both
packages so generated declarations no longer import `@hattip/core`.
