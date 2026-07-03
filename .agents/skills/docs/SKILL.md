---
name: docs
description: Maintain Rouzer documentation as a concern-oriented guide set that presents middleware and request context as Rouzer APIs.
---

# Rouzer Docs Skill

Use this skill when editing Rouzer documentation, README signposts, examples
referenced by docs, or docs-oriented migration notes.

## Documentation Model

Rouzer docs should be the complete place to understand what a user can do with
Rouzer. Middleware and request context should be documented as Rouzer surface
area.

Keep the root `README.md` as:

- a concise framework overview
- a smallest useful example
- a signpost to every focused guide under `docs/`
- links to runnable examples

Keep `docs/` split by concern:

- `docs/index.md`: learning path and guide map
- `docs/concepts.md`: framework model, lifecycle, and ownership boundaries
- `docs/routes.md`: route contracts, resources, actions, schemas, metadata, and
  raw bodies
- `docs/middleware.md`: Rouzer middleware chain and request context concepts
- `docs/handlers.md`: routers, handler maps, validation, config, and returns
- `docs/client.md`: generated client behavior, arguments, errors, hooks, and
  test fetch wrappers
- `docs/responses.md`: response markers, response maps, errors, and plugins
- `docs/streaming.md`: NDJSON response streams and cancellation
- `docs/runtime.md`: Fetch handlers, host data, CORS, and background work
- `docs/patterns.md`: preferred patterns, constraints, gotchas, and migrations

## Sources Of Truth

Before documenting behavior, verify it against the closest source of truth:

- Rouzer public TSDoc and types in `src/`
- tests and examples under `test/` and `examples/`
- current exported middleware declarations when the docs touch request context,
  middleware chains, or adapter helpers

Do not invent behavior from desired API shape. If source and docs disagree,
update the docs to match source unless the task is explicitly to design a future
API.

## Rouzer Facts To Preserve

- Route contracts are shared TypeScript route trees.
- `rouzer/http` owns resources, actions, method schemas, `rawBody`, and route
  metadata.
- `createRouter()` returns a fetch-compatible request handler with `.use(...)`.
- `createClient({ baseURL, routes })` creates a generated client that mirrors the
  route tree.
- Client action input is flat across path, query, and JSON body fields.
- Per-request `RequestInit` options are the second action argument; Rouzer
  reserves `method`.
- Raw-body actions with route input pass `body` in options; raw-body actions
  without route input pass the body as the first argument.
- `$type<T>()`, `$error<T>()`, and `ndjson.$type<T>()` are type contracts, not
  server-side response validators.
- Response plugin markers require matching router and client plugins.
- NDJSON is a response stream codec; request bodies still use ordinary Rouzer
  body schemas unless `http.rawBody()` is declared.

## Middleware And Context Facts To Preserve

- Common middleware APIs are exported from `rouzer`, including `chain`,
  `toFetchHandler`, `createContext`, `filterRuntime`, `RequestContext`, and
  `RequestHandler`.
- Present middleware and request context as Rouzer concepts.
- Host data lives under `ctx.host`, including `ctx.host.ip` and
  `ctx.host.runtime`.
- The reserved request plugin keys are `env`, `runtime`, and `onResponse`.
- `env` values are read through `ctx.env(name)`.
- `runtime` is a type-level marker for `ctx.host.runtime`; it does not create
  `ctx.runtime`.
- `ctx.onResponse(callback)` and returned `{ onResponse }` callbacks finalize or
  replace responses.
- `ctx.passThrough()` is chain-local control flow.
- Use root `toFetchHandler` for plain Web `Request` handlers.

## Writing Rules

- Keep guidance concern-oriented. Add to the focused guide instead of making a
  long catch-all page.
- Keep examples small but complete enough to show imports and the important
  type relationship.
- Prefer links between focused guides over duplicating long explanations.
- Link runnable examples when a topic already has one under `examples/`.
- Avoid marketing copy. Explain behavior, boundaries, and tradeoffs directly.
- Do not add new dependencies for documentation unless explicitly requested.

## Review Checklist

Before finishing a docs change:

1. Check README links still point to real files.
2. Check examples use root Rouzer imports for middleware and context helpers.
3. Search for implementation-detail package references before finishing.
4. Run Prettier on changed markdown when available.
5. Review the diff and keep the commit docs-only unless the user requested code
   changes.
