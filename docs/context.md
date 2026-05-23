# Rouzer context

Rouzer is for applications that want one TypeScript HTTP route tree to drive
both the server and the client that calls it. A route tree combines URL
patterns, named actions, HTTP method schemas, and optional compile-time JSON or
NDJSON response types.

## When to use Rouzer

Use Rouzer when:

- the same TypeScript project, package, or workspace can share route
  declarations between server and client code
- request validation should run before server handlers and before client `fetch`
  calls
- a Hattip-compatible handler fits your server runtime
- generated clients should stay close to route definitions instead of being
  produced by a separate OpenAPI build step

Rouzer is not a response validation library, an OpenAPI generator, or a complete
server framework. It focuses on typed route contracts, request validation,
routing, and a small client wrapper.

## Core abstractions

### HTTP route trees

Declare shared routes with the `rouzer/http` subpath:

```ts
import { $type } from 'rouzer'
import * as http from 'rouzer/http'

export const getProfile = http.get('profiles/:id', {
  response: $type<Profile>(),
})

export const routes = { getProfile }
```

An action is a callable endpoint leaf. Use `http.get`, `http.post`, `http.put`,
`http.patch`, or `http.delete` to declare one HTTP operation. The key you put the
action under is the client and handler name; the action path is the URL pattern.

Use `http.resource(path, children)` when several actions share a path prefix or
when you want nested client/handler namespaces:

```ts
export const profiles = http.resource('profiles/:id', {
  get: http.get({
    response: $type<Profile>(),
  }),
  update: http.patch({
    body: updateProfileSchema,
    response: $type<Profile>(),
  }),
  posts: http.resource('posts', {
    list: http.get({
      response: $type<Post[]>(),
    }),
  }),
})

export const routes = { profiles }
```

Resource property names do not affect the URL. Resource paths and action-local
paths are joined, so the examples above expose `profiles/:id`, `profiles/:id`,
and `profiles/:id/posts`. Path params from parent resources are accumulated into
child action types.

Patterns are parsed by `@remix-run/route-pattern` v0.21. Params can be inferred
from patterns such as `hello/:name`, `v:major.:minor`,
`api(/v:major(.:minor))`, `assets/*path`, and `search?q`. Full URL patterns such
as `https://:store.shopify.com/orders` are supported for top-level actions; keep
them out of resource/base-path composition.

### Method schemas

Method schemas describe the request pieces Rouzer should validate:

| Action helper                     | Request schemas                        | Notes            |
| --------------------------------- | -------------------------------------- | ---------------- |
| `http.get(...)`                   | `path`, `query`, `headers`, `response` | No request body. |
| `http.post/put/patch/delete(...)` | `path`, `body`, `headers`, `response`  | No query schema. |

If you omit a `path` schema, TypeScript infers path params from the pattern and
server handlers receive them as strings. Add a Zod `path` schema when you need
runtime validation, transforms, or non-string handler types.

The HTTP action API models explicit operations. It does not expose the old
method-map `ALL` fallback route shape; declare the concrete methods your client
and server support.

### `$type<T>()` and `ndjson.$type<T>()`

`response: $type<T>()` is a TypeScript-only marker for JSON response payloads.
It tells handlers and client action functions what response payload type to
expect, but Rouzer does not validate response bodies at runtime.

`response: ndjson.$type<T>()` is a TypeScript-only marker for newline-delimited
JSON response streams from the `rouzer/ndjson` subpath. Register
`ndjson.routerPlugin` with `createRouter(...)` and `ndjson.clientPlugin` with
`createClient(...)` for routes that use this marker. Handlers return an
`Iterable<T>` or `AsyncIterable<T>`; Rouzer serializes each item as one JSON line
and sets the response content type to `application/x-ndjson; charset=utf-8`.
Client action functions resolve to an `AsyncIterable<T>` parsed from the
response body. Streamed items are parsed as JSON but are not validated against a
Zod schema.

Actions without a `response` marker return a raw `Response` from client action
functions. Actions with `response: $type<T>()` use `client.json(...)` under the
hood and return parsed JSON typed as `T`.

### Response plugins

Response plugins add non-JSON response codecs without changing route matching or
request validation. A plugin package provides a compile-time response marker and
matching runtime plugins. For NDJSON, those are `ndjson.$type<T>()`,
`ndjson.routerPlugin`, and `ndjson.clientPlugin`.

The router plugin encodes non-`Response` handler results into an HTTP `Response`.
The client plugin decodes successful HTTP responses for generated client action
functions. Rouzer validates plugin registration when routes are attached to a
router or client, so routes that use an unregistered response marker fail fast
instead of falling back to JSON. Response plugins do not automatically validate
response payloads unless the plugin itself implements validation.

### Router

`createRouter()` returns a Hattip-compatible handler. Use `.use(middleware)` to
append typed `alien-middleware` middleware and `.use(routes, handlers)` to attach
an HTTP route tree.

The handler object mirrors the route tree:

```ts
createRouter().use(routes, {
  profiles: {
    get(ctx) {
      return loadProfile(ctx.path.id)
    },
    update(ctx) {
      return updateProfile(ctx.path.id, ctx.body)
    },
    posts: {
      list(ctx) {
        return listPosts(ctx.path.id)
      },
    },
  },
})
```

Handlers receive a context typed from middleware plus the action schema:

- `GET` handlers receive `ctx.path`, `ctx.query`, and `ctx.headers`
- mutation handlers receive `ctx.path`, `ctx.body`, and `ctx.headers`
- handlers may return a plain JSON-serializable value or a `Response`
- `ndjson.$type<T>()` handlers return an `Iterable<T>` or `AsyncIterable<T>`
  unless they return a custom `Response`
- plain values are returned with `Response.json(value)`
- NDJSON iterables are returned as `application/x-ndjson` streams
- return a `Response` when you need custom status, headers, or body handling

`basePath` is prepended to route tree paths, `debug` adds matched-route debug
headers and more detailed validation errors, and `cors.allowOrigins` restricts
requests with an `Origin` header.

### Client

`createClient({ baseURL, routes })` creates:

- `client.request(action.request(args))` for a raw `Response` when the action
  request factory contains the full path you want to call
- `client.json(action.request(args))` for parsed JSON and default non-2xx
  throwing
- response plugin support for generated client action functions, such as
  `ndjson.clientPlugin` for NDJSON response streams
- a client tree that mirrors `routes`, with action functions such as
  `client.profiles.get(args)` when `routes` is supplied

Prefer an absolute `baseURL` for generated client URLs:

```ts
const client = createClient({
  baseURL: new URL('/api/', window.location.origin).href,
  routes,
})
```

Default headers can be supplied with `headers`, per-request headers are merged on
top, and a custom `fetch` implementation can be supplied for tests or non-browser
runtimes.

## Lifecycle

1. Define shared HTTP actions/resources with `rouzer/http` and Zod schemas.
2. Attach that route tree to a server with `createRouter().use(routes, handlers)`
   or `createRouter({ plugins }).use(routes, handlers)` when response plugins
   are needed.
3. Create a client with the same route tree, plus matching client response
   plugins when needed.
4. Client action calls validate `path`, `query`, `body`, and `headers` before
   `fetch`.
5. The router matches the request, validates the matched inputs, and calls the
   handler.
6. Plain handler results become JSON responses, plugin handler results become
   plugin-encoded responses, and explicit `Response` objects pass through
   unchanged.

On the server, `path`, `query`, and `headers` values originate as strings. Rouzer
coerces Zod `number` schemas with `Number(value)` and Zod `boolean` schemas from
`"true"` and `"false"`. JSON request bodies are parsed and validated without that
string-coercion step.

## Common tasks

### Choose a client call style

Use client action functions for normal application calls:

```ts
await client.profiles.get({ path: { id: '42' } })
await client.profiles.update({
  path: { id: '42' },
  body: { name: 'Ada' },
})
```

Use longhand calls when you need to choose response handling explicitly. The
action request factory must include the full path you want to call, so this style
is most convenient for top-level actions:

```ts
export const getProfile = http.get('profiles/:id', {
  response: $type<Profile>(),
})
export const routes = { getProfile }

const response = await client.request(
  routes.getProfile.request({ path: { id: '42' } })
)

const json = await client.json(
  routes.getProfile.request({ path: { id: '42' } })
)
```

Response plugins are applied by generated client action functions. For longhand
calls to plugin-backed routes, use `client.request(...)` for the raw `Response`
and call the plugin subpath's decoder yourself.

### Stream newline-delimited JSON

Use `ndjson.$type<T>()` when a handler should produce a sequence of JSON values
without buffering the whole response:

```ts
import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

export const events = http.get('events', {
  response: ndjson.$type<{ id: number; message: string }>(),
})
export const routes = { events }

createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  async *events() {
    yield { id: 1, message: 'ready' }
    yield { id: 2, message: 'done' }
  },
})

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
  plugins: [ndjson.clientPlugin],
})
for await (const event of await client.events()) {
  console.log(event.message)
}
```

A complete runnable version lives in
[`examples/ndjson-stream.ts`](../examples/ndjson-stream.ts).

Rouzer's decoder accepts `\n` and `\r\n`, handles UTF-8 chunk boundaries, and
throws a `SyntaxError` with a line number for malformed JSON. If a consumer stops
reading early, the response body is cancelled.

Rouzer does not convert handler or generator failures into extra NDJSON items. If
an async generator throws after the response starts, the response stream errors
and the client's `for await` loop throws. Model application-level stream errors
as part of your item type, for example `{ type: 'error'; message: string }`, when
clients should receive them as data.

### Group resource actions

Use resources when the public API reads better as a tree or when actions share
path params:

```ts
export const organizations = http.resource('orgs/:orgId', {
  members: http.resource('members/:memberId', {
    get: http.get({ response: $type<Member>() }),
    remove: http.delete({}),
  }),
})

await client.organizations.members.get({
  path: { orgId: 'acme', memberId: '42' },
})
```

### Return custom responses

Return a `Response` from a handler for non-JSON payloads, custom status codes, or
custom headers. Return a plain value for the default `Response.json(value)` path.

### Customize JSON errors

By default, `client.json(...)` and generated client action functions throw for
non-2xx responses. If the response body is JSON, its properties are copied onto
the thrown `Error`.

`onJsonError` can override that behavior. Its return value is returned from the
response helper as-is; Rouzer does not automatically parse a returned `Response`
from `onJsonError`.

### v2->v3 migration

Rouzer now uses action/resource route trees for router registration and client
shorthands. In the v2->v3 migration, a method-map route such as this:

```ts
export const profileRoute = route('profiles/:id', {
  GET: { response: $type<Profile>() },
  PATCH: { body: updateProfileSchema, response: $type<Profile>() },
})

export const routes = { profileRoute }
```

becomes a named action tree:

```ts
import * as http from 'rouzer/http'

export const profiles = http.resource('profiles/:id', {
  get: http.get({ response: $type<Profile>() }),
  update: http.patch({
    body: updateProfileSchema,
    response: $type<Profile>(),
  }),
})

export const routes = { profiles }
```

Handler maps and client calls mirror the new action names:

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

await client.profiles.get({ path: { id: '42' } })
await client.profiles.update({
  path: { id: '42' },
  body: { name: 'Ada' },
})
```

## Patterns to prefer

- Export route trees from a small shared module and import that module on both
  server and client.
- Use `rouzer/http` actions for routes that are registered with
  `createRouter().use(...)` or `createClient({ routes })`.
- Add Zod schemas when you need runtime guarantees; rely on inferred path params
  only when string params are sufficient.
- Use `response: $type<T>()` for JSON endpoints that should have typed client
  action functions.
- Use `response: ndjson.$type<T>()` plus `ndjson.routerPlugin` and
  `ndjson.clientPlugin` for response streams where each line is a JSON value and
  the client should consume an `AsyncIterable<T>`.
- Name actions after domain operations (`get`, `list`, `update`, `archive`) and
  let `http.get/post/put/patch/delete` own the transport method.
- Set `content-type: application/json` yourself when your server or middleware
  depends on that header.

## Constraints and gotchas

- `$type<T>()` and `ndjson.$type<T>()` are compile-time only and do not validate
  response payloads or streamed items.
- NDJSON support is for response streams; request bodies still use the existing
  JSON body schema path.
- Routes that use a response plugin fail fast if the matching client or router
  plugin is not registered.
- Pathname route patterns expect an absolute client `baseURL`.
- Resource and action keys are API names only; paths come from the pattern
  strings passed to `http.resource(...)` and action helpers.
- Nested action `.request(...)` factories do not include parent resource paths;
  prefer client action functions for nested resources.
- Extra `RequestInit` fields in route args, such as `signal` or `credentials`,
  are forwarded by `createClient`; `method`, `body`, and `headers` are reserved
  for Rouzer's action metadata and validated call arguments.
- The HTTP action API has no `ALL` fallback route. Declare explicit actions for
  supported methods.
- Rouzer does not automatically set `Access-Control-Allow-Credentials`; set it in
  your handler when credentialed cross-origin requests need it.
