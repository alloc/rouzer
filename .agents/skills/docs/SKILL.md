---
name: docs
description: Maintain Rouzer documentation as a concern-oriented guide set that covers both Rouzer APIs and Alien Middleware concepts.
---

# Rouzer Docs Skill

Use this skill when editing Rouzer documentation, README signposts, examples
referenced by docs, or docs-oriented migration notes.

## Documentation Model

Rouzer docs should be the complete place to understand what a user can do with
Rouzer and the Alien Middleware concepts needed to use it.

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
- `docs/middleware.md`: Alien Middleware chain and request context concepts
- `docs/handlers.md`: routers, handler maps, validation, config, and returns
- `docs/client.md`: generated client behavior, arguments, errors, hooks, and
  test fetch wrappers
- `docs/responses.md`: response markers, response maps, errors, and plugins
- `docs/streaming.md`: NDJSON response streams and cancellation
- `docs/runtime.md`: Fetch handlers, srvx, host data, CORS, and background work
- `docs/patterns.md`: preferred patterns, constraints, gotchas, and migrations
- `docs/context.md`: compatibility pointer for older links

## Sources Of Truth

Before documenting behavior, verify it against the closest source of truth:

- Rouzer public TSDoc and types in `src/`
- tests and examples under `test/` and `examples/`
- Alien Middleware declarations in `node_modules/alien-middleware/dist/*.d.ts`
- Alien Middleware migration notes in
  `../alien-middleware/docs/migration-v0.11-to-v0.12.md` when the docs touch the
  v0.12 Web request contract

Do not invent behavior from desired API shape. If source and docs disagree,
update the docs to match source unless the task is explicitly to design a future
API.

## Rouzer Facts To Preserve

- Route contracts are shared TypeScript route trees.
- `rouzer/http` owns resources, actions, method schemas, `rawBody`, and route
  metadata.
- `createRouter()` returns a fetch-compatible Alien Middleware request handler
  with `.use(...)`.
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

## Alien Middleware Facts To Preserve

- Common Alien Middleware APIs are re-exported from `rouzer`, including `chain`,
  `toFetchHandler`, `createContext`, `filterRuntime`, `RequestContext`, and
  `RequestHandler`.
- Host data lives under `ctx.host`, including `ctx.host.ip` and
  `ctx.host.runtime`.
- Do not document Hattip types or `ctx.platform` as current API.
- The reserved request plugin keys are `env`, `runtime`, and `onResponse`.
- `env` values are read through `ctx.env(name)`.
- `runtime` is a type-level marker for `ctx.host.runtime`; it does not create
  `ctx.runtime`.
- `ctx.onResponse(callback)` and returned `{ onResponse }` callbacks finalize or
  replace responses.
- `ctx.passThrough()` is chain-local control flow.
- Use `alien-middleware/srvx` when mounting srvx `ServerRequest` handlers and
  root `toFetchHandler` for plain Web `Request` handlers.

## Writing Rules

- Keep guidance concern-oriented. Add to the focused guide instead of making a
  long catch-all page.
- Keep examples small but complete enough to show imports and the important
  type relationship.
- Prefer links between focused guides over duplicating long explanations.
- Link runnable examples when a topic already has one under `examples/`.
- Avoid marketing copy. Explain behavior, boundaries, and tradeoffs directly.
- Do not add new dependencies for documentation unless explicitly requested.
- Keep `docs/context.md` as a compatibility map unless a task explicitly removes
  old-link support.

## Review Checklist

Before finishing a docs change:

1. Check README links still point to real files.
2. Check examples use current imports and current Alien Middleware names.
3. Search for stale `Hattip`, `platform`, or `filterPlatform` references unless
   they appear only in migration context.
4. Run Prettier on changed markdown when available.
5. Review the diff and keep the commit docs-only unless the user requested code
   changes.
