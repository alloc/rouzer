# Rollout Plan

## Phase 1: Decide the public contract

Decisions to make before implementation:

- Whether root exports should be purely Web-standard or mention srvx types.
- Whether `alien-middleware/srvx` is worth a subpath export.
- Whether to keep deprecated Hattip aliases for one release.
- Whether to rename `platform` to `runtime`, or introduce `host.runtime` while
  keeping `platform` as an alias.

Recommended answers:

- Keep the root API Web-standard.
- Add `alien-middleware/srvx` only for srvx-specific `ServerRequest` typing.
- Publish a major version if Hattip public types are removed.
- Use `context.host.runtime` for srvx host data.

## Phase 2: Migrate `alien-middleware`

Implementation steps:

1. Add package-owned context and handler types.
2. Add `createContext({ request, host })`.
3. Update `runMiddlewareChain` to use the local context.
4. Add `toFetchHandler`.
5. Add `alien-middleware/srvx` helper if srvx types are exported.
6. Update router callable types.
7. Update or alias `filterPlatform`.
8. Replace Hattip test contexts.
9. Update README examples.
10. Rebuild and verify declarations.

Verification:

```sh
pnpm test run --coverage
pnpm build
rg '@hattip|Hattip' src test dist readme.md package.json
```

## Phase 3: Migrate `rouzer`

Implementation steps:

1. Update the `alien-middleware` dependency to the migrated version.
2. Remove `@hattip/core` and `@hattip/adapter-test`.
3. Update `src/server/router.ts` types and comments.
4. Add or document srvx helper usage.
5. Replace Hattip test fixtures with fetch-based fixtures.
6. Update examples, README, and `docs/context.md`.
7. Rebuild generated `dist`.

Verification:

```sh
pnpm test
pnpm build
rg '@hattip|Hattip' src test dist README.md docs examples package.json
```

## Phase 4: App adoption

Primary usage:

```ts
import { serve } from 'srvx'
import { toFetchHandler } from 'alien-middleware/srvx'
import { createRouter } from 'rouzer'
import { handlers, routes } from './api'

const router = createRouter({ basePath: 'api/' }).use(routes, handlers)

serve({
  port: 3000,
  fetch: toFetchHandler(router),
})
```

CLI usage:

```ts
// server.ts
import { toFetchHandler } from 'alien-middleware/srvx'

export default {
  fetch: toFetchHandler(router),
}
```

Then:

```sh
srvx serve --entry ./server.ts
```

## Risks

- srvx is currently `0.11.18`, so it is pre-1.0 even though the API is small.
- srvx does not provide Hattip's `env(variable)` or adapter-level
  `passThrough()` semantics. These need package-owned definitions.
- Bundled applications need to respect srvx ESM conditions or mark `srvx`
  external so the correct runtime entry resolves.
- Consumers that depend on Hattip type names or `context.platform` need a
  migration path.

## Open implementation questions

- Should `toFetchHandler()` live in the root export or only in
  `alien-middleware/srvx`?
- Should `context.host.runtime` store the whole srvx `request.runtime` object or
  a normalized subset?
- Should `context.env()` default to `process.env` in Node.js or require explicit
  adapter configuration?
- Should Rouzer export `rouzer/srvx`, or should all mounting helpers stay in
  `alien-middleware`?
