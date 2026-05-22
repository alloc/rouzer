# Rouzer context

Rouzer is for applications that want one route contract to drive both the HTTP
server and the client that calls it. A route declaration combines a URL pattern,
HTTP method schemas, and an optional compile-time response type.

## When to use Rouzer

Use Rouzer when:

- the same TypeScript project, package, or workspace can share route
  declarations between server and client code
- request validation should run before server handlers and before client `fetch`
  calls
- a Hattip-compatible handler fits your server runtime
- generated clients should stay close to the route definitions instead of being
  produced by a separate OpenAPI build step

Rouzer is not a response validation library, an OpenAPI generator, or a complete
server framework. It focuses on typed route contracts, validation, routing, and a
small client wrapper.

## Core abstractions

### Route declarations

Declare routes with `route(pattern, methods)`. The pattern is parsed by
`@remix-run/route-pattern`, so route params can be inferred from patterns such
as `hello/:name`, `v:major.:minor`, `api(/v:major(.:minor))`, `assets/*path`,
`search?q`, or full URL patterns such as
`https://:store.shopify.com/orders`.

Method schemas describe the request pieces Rouzer should validate:

| Method kind                      | Request schemas                        | Notes                                                                                   |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET`                            | `path`, `query`, `headers`, `response` | No request body.                                                                        |
| `POST`, `PUT`, `PATCH`, `DELETE` | `path`, `body`, `headers`, `response`  | No query schema.                                                                        |
| `ALL`                            | `path`, `query`, `headers`             | Fallback when the incoming method is not explicitly declared. No body or response type. |

If you omit a `path` schema, TypeScript infers path params from the pattern and
server handlers receive them as strings. Add a Zod `path` schema when you need
runtime validation, transforms, or non-string handler types.

### `$type<T>()`

`response: $type<T>()` is a TypeScript-only marker. It tells handlers and client
shorthand methods what response payload type to expect, but Rouzer does not
validate response bodies at runtime.

Routes without a `response` marker return a raw `Response` from client shorthand
methods. Routes with a `response` marker use `client.json(...)` under the hood
and return parsed JSON typed as `T`.

### Router

`createRouter()` returns a Hattip-compatible handler. Use `.use(middleware)` to
append typed `alien-middleware` middleware and `.use(routes, handlers)` to attach
route handlers.

Handlers receive a context typed from middleware plus the route schema:

- `GET` handlers receive `ctx.path`, `ctx.query`, and `ctx.headers`
- mutation handlers receive `ctx.path`, `ctx.body`, and `ctx.headers`
- handlers may return a plain JSON-serializable value or a `Response`
- plain values are returned with `Response.json(value)`
- return a `Response` when you need custom status, headers, or body handling

`basePath` is prepended to route patterns, `debug` adds matched-route debug
headers and more detailed validation errors, and `cors.allowOrigins` restricts
requests with an `Origin` header.

### Client

`createClient({ baseURL, routes })` creates:

- `client.request(route.GET(args))` for a raw `Response`
- `client.json(route.GET(args))` for parsed JSON and default non-2xx throwing
- shorthand methods such as `client.helloRoute.GET(args)` when `routes` is
  supplied

Prefer an absolute `baseURL` for pathname route patterns:

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

1. Define shared route declarations with `route(...)` and Zod schemas.
2. Attach those routes to a server with `createRouter().use(routes, handlers)`.
3. Create a client with the same route map.
4. Client calls validate `path`, `query`, `body`, and `headers` before `fetch`.
5. The router matches the request, validates the matched inputs, and calls the
   handler.
6. Plain handler results become JSON responses; explicit `Response` objects pass
   through unchanged.

On the server, `path`, `query`, and `headers` values originate as strings. Rouzer
coerces Zod `number` schemas with `Number(value)` and Zod `boolean` schemas from
`"true"` and `"false"`. JSON request bodies are parsed and validated without that
string-coercion step.

## Common tasks

### Choose a client call style

Use shorthand methods for normal application calls:

```ts
await client.helloRoute.GET({ path: { name: 'Ada' } })
```

Use longhand calls when you need to choose response handling explicitly:

```ts
const response = await client.request(
  routes.helloRoute.GET({ path: { name: 'Ada' } })
)

const json = await client.json(routes.helloRoute.GET({ path: { name: 'Ada' } }))
```

### Return custom responses

Return a `Response` from a handler for non-JSON payloads, custom status codes, or
custom headers. Return a plain value for the default `Response.json(value)` path.

### Customize JSON errors

By default, `client.json(...)` throws for non-2xx responses. If the response body
is JSON, its properties are copied onto the thrown `Error`.

`onJsonError` can override that behavior. Its return value is returned from
`client.json(...)` as-is; Rouzer does not automatically parse a returned
`Response` from `onJsonError`.

## Patterns to prefer

- Export route declarations from a small shared module and import that module on
  both server and client.
- Add Zod schemas when you need runtime guarantees; rely on inferred path params
  only when string params are sufficient.
- Use `response: $type<T>()` for JSON endpoints that should have typed client
  shorthand methods.
- Use explicit HTTP methods when you want precise handler context types; reserve
  `ALL` for true fallback behavior.
- Set `content-type: application/json` yourself when your server or middleware
  depends on that header.

## Constraints and gotchas

- `$type<T>()` is compile-time only and does not validate response payloads.
- Pathname route patterns currently expect an absolute client `baseURL`.
- Extra `RequestInit` fields in route args, such as `signal` or `credentials`,
  are accepted by the type surface but are not forwarded by the current
  `createClient` implementation.
- `ALL` can declare `query`, but handler context typing is less precise than
  explicit `GET` handlers.
- Rouzer does not automatically set `Access-Control-Allow-Credentials`; set it in
  your handler when credentialed cross-origin requests need it.
