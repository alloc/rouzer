# Rouzer Changes

Rouzer's migration is mostly a type and fixture update after `alien-middleware`
owns a Web/srvx-compatible context.

## Dependencies

Change `package.json`:

- Remove `@hattip/core` from `dependencies`.
- Remove `@hattip/adapter-test` from `devDependencies`.
- Add `srvx` as a development dependency if Rouzer exports srvx helpers or tests
  use `ServerRequest` types.
- Depend on the migrated `alien-middleware` version.

If Rouzer exports srvx-specific helpers directly, add:

```json
{
  "./srvx": {
    "types": "./dist/srvx.d.ts",
    "import": "./dist/srvx.js"
  }
}
```

## Router type

Update `src/server/router.ts`:

- Remove `AdapterRequestContext` and `HattipHandler` imports.
- Import the new `RequestHandler` type from `alien-middleware`.
- Change `Router<T>` to extend `RequestHandler<T>` and `MiddlewareChain<T>`.
- Update helper function signatures that currently accept
  `AdapterRequestContext`.
- Remove Hattip wording from comments.

The route logic itself can stay as-is. It already depends on:

- `context.request`
- `context.url`
- `context.setHeader`
- Middleware-supplied context properties

Those are all preserved by the proposed alien-middleware context.

## srvx helper

Rouzer can either rely on `alien-middleware`'s generic `toFetchHandler` or export
a tiny convenience helper.

Sketch:

```ts
import { toFetchHandler } from 'alien-middleware/srvx'
import type { Router } from './server/router'

export function toSrvxHandler(router: Router) {
  return toFetchHandler(router)
}
```

Consumer usage:

```ts
import { serve } from 'srvx'
import { createRouter } from 'rouzer'
import { toSrvxHandler } from 'rouzer/srvx'
import { handlers, routes } from './api'

const router = createRouter({ basePath: 'api/' }).use(routes, handlers)

serve({
  fetch: toSrvxHandler(router),
})
```

If the project wants less API surface, skip `rouzer/srvx` and document:

```ts
import { toFetchHandler } from 'alien-middleware/srvx'
```

## Tests

Replace `@hattip/adapter-test` in:

- `test/fixtures/shared.ts`
- `test/fixtures/server-validation/test.ts`

with a local fetch helper:

```ts
function createTestFetch(handler: RequestHandler): typeof fetch {
  return (input, init) => {
    const request =
      input instanceof Request
        ? init
          ? new Request(input, init)
          : input
        : new Request(input, init)

    return handler(createTestContext(request))
  }
}
```

Rouzer's tests do not need a real srvx server for normal route validation. Add
one integration test with `serve({ port: 0, fetch })` only if the helper exports
need runtime coverage.

## Examples and docs

Update:

- `README.md`
- `docs/context.md`
- `examples/basic-usage.ts`
- `examples/error-responses.ts`
- `examples/ndjson-stream.ts`

Replace "Hattip-compatible" with either "fetch-compatible" or
"srvx-compatible". Prefer "fetch-compatible" for the core router API and
"srvx-compatible" only when showing `serve`.

Example documentation pattern:

```ts
import { serve } from 'srvx'
import { toFetchHandler } from 'alien-middleware/srvx'

const handler = createRouter({ basePath: 'api/' }).use(routes, handlers)

serve({
  fetch: toFetchHandler(handler),
})
```

## Generated dist files

Do not hand-edit `dist`. Rebuild after source changes so generated declarations
no longer import `@hattip/core`.
