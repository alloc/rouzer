# Rollout Plan

## Phase 1: Decide the public contract

Decisions to make before implementation:

- Whether Nitro v3 beta is acceptable as a public dependency now.
- Whether `alien-middleware` should stay Web-only in its root export and expose
  Nitro helpers under `alien-middleware/nitro`.
- Whether to keep deprecated Hattip-named type aliases for one release.
- Whether `platform` remains a top-level context field or moves to
  `context.host.platform`.

Recommended answers:

- Keep core `alien-middleware` Web-only.
- Put Nitro helpers behind `alien-middleware/nitro`.
- Publish a major version if Hattip public types are removed.
- Move host-specific data to `context.host`, with a temporary `platform` alias
  only if compatibility is required.

## Phase 2: Migrate `alien-middleware`

Implementation steps:

1. Add package-owned context and handler types.
2. Add a context factory used by runtime code and tests.
3. Update `runMiddlewareChain` to use the new context.
4. Update `routes()` and router types.
5. Update `filterPlatform`.
6. Add Nitro adapter and optional Web fetch adapter.
7. Replace tests that import `@hattip/core`.
8. Update README language and examples.
9. Build and verify generated `dist` declarations contain no `@hattip/core`
   imports.

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
3. Update `src/server/router.ts` imports and `Router` interface.
4. Add or document Nitro adapter usage.
5. Replace Hattip test fixtures with local Web/Nitro fixtures.
6. Update examples, README, and `docs/context.md`.
7. Rebuild generated `dist` files.

Verification:

```sh
pnpm test
pnpm build
rg '@hattip|Hattip' src test dist README.md docs examples package.json
```

## Phase 4: App-level adoption

For consumers using Rouzer inside Nitro, document one primary mounting pattern.

Server-entry pattern:

```ts
import { toFetchHandler } from 'alien-middleware'
import { createRouter } from 'rouzer'
import { handlers, routes } from './api'

const router = createRouter({ basePath: 'api/' }).use(routes, handlers)

export default {
  fetch: toFetchHandler(router),
}
```

Nitro event-handler pattern:

```ts
import { toNitroHandler } from 'alien-middleware/nitro'
import { createRouter } from 'rouzer'
import { handlers, routes } from './api'

export default toNitroHandler(
  createRouter({ basePath: 'api/' }).use(routes, handlers)
)
```

The event-handler pattern is the better default if middleware needs
`event.waitUntil`, Nitro hooks, or Nitro event context.

## Risks

- Nitro v3 docs and package are currently beta, so handler type names or import
  paths may still change.
- Hattip's `passThrough()` maps imperfectly to Nitro. The migration should define
  alien-middleware `passThrough()` as chain-local control flow and keep Nitro
  lifecycle continuation in the adapter.
- Hattip's `env(variable)` model does not directly match Nitro runtime config.
  Keep `context.env()` as alien-middleware's typed accessor and let the Nitro
  adapter source values from runtime config, environment variables, or caller
  configuration.
- Public type names containing `Hattip` require either aliases or a breaking
  release.
- Consumers using `context.platform` will need a migration path.

## Open implementation questions

- Should the Nitro adapter expose the raw Nitro event under
  `context.host.platform`, `context.host.event`, or a dedicated symbol-backed
  property?
- Should `toFetchHandler()` return `404` for unmatched requests or return
  `undefined` for Nitro server-entry continuation? These are different use
  cases and may need separate helpers.
- Should Rouzer export its own `toNitroRouter()` wrapper or rely on
  `alien-middleware/nitro` to avoid duplicate API surface?
- Should the packages support Hattip and Nitro simultaneously for one transition
  release, or is a clean major-version break preferred?
