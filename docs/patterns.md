# Patterns, constraints, and migrations

Use this page as a checklist when designing route modules, middleware, and
client usage. For the current server-boundary upgrade, use
[Migration from v5 to v6](migration-v5-to-v6.md).

## Preferred Patterns

- Export route trees from small shared modules and import them from server and
  client code.
- Keep route declarations close to domain boundaries, not scattered through
  handler implementations.
- Use `http.resource(...)` for resource namespaces and shared path params.
- Name actions after domain operations such as `get`, `list`, `update`,
  `archive`, and `stream`.
- Let `http.get`, `http.post`, `http.put`, `http.patch`, and `http.delete` own
  the transport method.
- Add Zod schemas when runtime guarantees matter; rely on inferred path params
  only when string params are enough.
- Use `$type<T>()` for typed JSON success responses.
- Use response maps with `$error<T>()` for declared application errors that
  callers should handle as data.
- Use `Response` returns for redirects, binary payloads, custom non-JSON error
  bodies, or unusual headers.
- Use `ndjson.$type<T>()` only for response streams where each line is a JSON
  value.
- Put shared auth, tracing, request IDs, environment bindings, and host-runtime
  checks in middleware before route registration.

## Constraints And Gotchas

- `$type<T>()`, `$error<T>()`, and `ndjson.$type<T>()` are compile-time type
  contracts. They do not re-validate handler return values.
- Client action input is flat across path, query, and JSON body fields. Avoid
  duplicate field names across those schemas.
- Per-request `RequestInit` fields belong in the second client action argument.
  Rouzer reserves `method`.
- Raw-body actions with path or query input accept `body` in the second
  argument. Raw-body actions without route input accept the body as the first
  argument.
- `GET` actions do not accept request bodies. Mutation actions do not accept
  query schemas.
- The action API has no `ALL` fallback route. Declare concrete actions for
  supported HTTP methods.
- Pathname route patterns expect an absolute client `baseURL`.
- Resource and action keys are API names only. URL paths come from the pattern
  strings passed to resources and actions.
- Routes that use response plugin markers require matching router and client
  plugins.
- Declared `$error<T>()` responses are JSON responses. Use a custom `Response`
  for non-JSON error payloads.
- Rouzer CORS support does not set `Access-Control-Allow-Credentials`.

## Middleware Constraints

- Host data is under `ctx.host`, including `ctx.host.ip` and
  `ctx.host.runtime`.
- The `env`, `runtime`, and `onResponse` request plugin keys are reserved.
- `runtime` is a type-level marker for `ctx.host.runtime`; it does not create
  `ctx.runtime`.
- Use `ctx.setHeader` from request middleware and `response.headers.set(...)`
  inside response callbacks.
- `ctx.passThrough()` skips the rest of the current chain. It is not an adapter
  pass-through mechanism.
- Use `.isolate()` when a chain should run without leaking context properties to
  the parent chain.

## Project Shape

A common layout:

```text
src/
  routes/
    profiles.ts
  server/
    middleware.ts
    router.ts
  client/
    api.ts
```

`routes/profiles.ts` exports route contracts. `server/router.ts` imports those
contracts and attaches handlers. `client/api.ts` imports the same contracts and
creates the typed client.

Keep route modules free of server-only dependencies when browser clients import
them.

## v2 To v3 Route Shape

Older Rouzer code used method-map routes. Current Rouzer uses action/resource
route trees.

```ts
// Old shape
export const profileRoute = route('profiles/:id', {
  GET: { response: $type<Profile>() },
  PATCH: { body: updateProfileSchema, response: $type<Profile>() },
})
```

Use named actions instead:

```ts
export const profiles = http.resource('profiles/:id', {
  get: http.get({ response: $type<Profile>() }),
  update: http.patch({
    body: updateProfileSchema,
    response: $type<Profile>(),
  }),
})

export const routes = { profiles }
```

Handler maps and clients mirror those action names.

```ts
createRouter().use(routes, {
  profiles: {
    get(ctx) {
      return loadProfile(ctx.path.id)
    },
    update(ctx) {
      return updateProfile(ctx.path.id, ctx.body)
    },
  },
})

await client.profiles.get({ id: '42' })
await client.profiles.update({ id: '42', name: 'Ada' })
```

## Runtime Context Notes

Use `ctx.host.runtime` for host runtime metadata and `filterRuntime(...)` for
runtime-specific branches. Keep runtime checks at the middleware boundary so
route handlers stay focused on request validation and application behavior.
