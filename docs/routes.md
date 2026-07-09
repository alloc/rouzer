# Route contracts

> Define each HTTP operation once so its URL, validated input, handler type, and
> generated client call stay aligned.

Declare route contracts with the `rouzer/http` subpath. A route contract is the
shared source of truth for server handler types, client action types, URL
construction, and request validation.

```ts
import { $type, metadata } from 'rouzer'
import * as http from 'rouzer/http'
import * as z from 'zod'

type Profile = {
  id: string
  name: string
}

export const profiles = http.resource('profiles/:id', {
  ...metadata({ description: 'Profile operations' }),
  get: http.get({
    query: z.object({
      includePosts: z.optional(z.boolean()),
    }),
    response: $type<Profile>(),
  }),
  update: http.patch({
    body: z.object({
      name: z.string().check(z.minLength(1)),
    }),
    response: $type<Profile>(),
  }),
})

export const routes = { profiles }
```

## Resources

Use `http.resource(path, children)` when actions share a path prefix or when the
client API should be namespaced.

```ts
export const organizations = http.resource('orgs/:orgId', {
  members: http.resource('members/:memberId', {
    get: http.get({ response: $type<Member>() }),
    remove: http.delete({}),
  }),
})

await client.organizations.members.get({
  orgId: 'acme',
  memberId: '42',
})
```

Resource keys are API names. They do not affect the URL. Resource path patterns
and action-local path patterns are joined to produce the final route path.

## Actions

Use an action for each HTTP operation:

| Helper             | Request schemas                        | Notes                                       |
| ------------------ | -------------------------------------- | ------------------------------------------- |
| `http.get(...)`    | `path`, `query`, `headers`, `response` | `GET` actions do not accept request bodies. |
| `http.post(...)`   | `path`, `body`, `headers`, `response`  | Mutation action. No `query` schema.         |
| `http.put(...)`    | `path`, `body`, `headers`, `response`  | Mutation action. No `query` schema.         |
| `http.patch(...)`  | `path`, `body`, `headers`, `response`  | Mutation action. No `query` schema.         |
| `http.delete(...)` | `path`, `body`, `headers`, `response`  | Mutation action. No `query` schema.         |

Each helper accepts either `(schema)` or `(path, schema)`.

```ts
export const listProfiles = http.get('profiles', {
  query: z.object({ page: z.optional(z.number()) }),
  response: $type<Profile[]>(),
})

export const getProfile = http.get({
  response: $type<Profile>(),
})
```

The HTTP action API models explicit operations. It does not have an `ALL`
fallback route. Declare each supported method directly.

## Path Patterns

Rouzer uses `@remix-run/route-pattern` for path patterns. Common patterns
include:

- `profiles/:id`
- `v:major.:minor`
- `api(/v:major(.:minor))`
- `assets/*path`
- `search?q`

If you omit a `path` schema, TypeScript infers path params from the route
pattern and server handlers receive strings. Add a Zod `path` schema when you
need runtime validation, transforms, or non-string handler types.

```ts
export const profile = http.get('profiles/:id', {
  path: z.object({
    id: z.uuid(),
  }),
  response: $type<Profile>(),
})
```

Full URL patterns can be used for top-level actions. Keep full URL patterns out
of resource/base-path composition because resources and router `basePath`
compose path segments.

## Request Schemas

Request schemas are Zod objects except for `body: http.rawBody()`.

```ts
export const updateProfile = http.patch('profiles/:id', {
  path: z.object({ id: z.uuid() }),
  body: z.object({ name: z.string() }),
  headers: z.object({
    'content-type': z.literal('application/json'),
  }),
  response: $type<Profile>(),
})
```

On the client, path, query, and JSON body fields are flattened into the first
action argument.

> [!IMPORTANT]
> Keep field names unique across path, query, and JSON body schemas. A flat
> client input cannot represent separate values for the same key.

```ts
await client.updateProfile({
  id: 'a0f12d72-24e5-4eb0-bb70-6345f574e62a',
  name: 'Ada',
})
```

Per-request `RequestInit` options, including headers and abort signals, are
passed as the second argument.

## Raw Bodies

Use `http.rawBody()` when an action should pass a `BodyInit` through to `fetch`
without JSON encoding.

```ts
export const uploadAvatar = http.post('profiles/:id/avatar', {
  body: http.rawBody(),
  headers: z.object({ 'content-type': z.string() }),
})

await client.uploadAvatar(
  { id: '42' },
  { body: file, headers: { 'content-type': file.type } }
)
```

> [!NOTE]
> Raw-body argument placement depends on route input. With path or query input,
> pass the body as `options.body`; without route input, pass the body as the
> first argument.

For a raw-body route without path or query input, the generated client accepts
the body as the first argument.

```ts
export const upload = http.post('uploads', {
  body: http.rawBody(),
})

await client.upload(file, {
  headers: { 'content-type': file.type },
})
```

Server handlers for raw-body routes read from `ctx.request` with Fetch APIs such
as `arrayBuffer()`, `blob()`, `formData()`, or `text()`. Rouzer does not parse
or validate raw request bodies.

## Metadata

Use `metadata(...)` to attach optional runtime metadata to resources or actions.
Metadata does not affect routing, validation, client typing, or handler
behavior.

```ts
export const sessions = http.resource('sessions', {
  ...metadata({ description: 'Session control' }),
  list: http.post('list', {
    ...metadata({ description: 'List sessions' }),
    response: $type<SessionList>(),
  }),
})
```

Constructed route nodes expose metadata through `node.metadata`. Use it for
generated documentation, CLIs, route inspectors, or application-specific
tooling.
