# Framework concepts

Rouzer is for applications that can share a TypeScript HTTP contract between
server and client code. The central object is an HTTP route tree. That tree
describes URL paths, action names, request schemas, and response contracts once,
then it is reused by the router and generated client.

Rouzer is not an OpenAPI generator, a response validator, or a full application
framework. It focuses on shared route contracts, request validation, typed
handlers, typed clients, and response helpers. Alien Middleware supplies the
middleware and request-context layer under that router.

## The Main Objects

Route tree:

- a plain object whose leaves are HTTP actions and whose branches are resources
- exported from a shared module that server and client code can both import
- passed to `createRouter().use(routes, handlers)` and
  `createClient({ routes, baseURL })`

Action:

- a concrete HTTP operation declared with `http.get`, `http.post`, `http.put`,
  `http.patch`, or `http.delete`
- owns an optional action-local path, request schemas, and an optional response
  marker or response map
- becomes one handler function on the server and one generated client function

Resource:

- a path-scoped namespace declared with `http.resource(path, children)`
- contributes path params to child actions
- creates nested handler and client objects

Router:

- a fetch-compatible Alien Middleware request handler returned by
  `createRouter(...)`
- accepts middleware with `.use(middleware)`
- accepts route trees with `.use(routes, handlers)`
- validates matched requests before handlers run

Client:

- a typed fetch wrapper returned by `createClient({ baseURL, routes })`
- mirrors the route tree shape
- validates client input before sending requests
- parses responses according to the route response contract

Middleware:

- Alien Middleware functions that receive a shared `RequestContext`
- can add typed properties, environment bindings, response callbacks, or runtime
  type markers
- run before route handlers when attached before `.use(routes, handlers)`

## What Validation Covers

Rouzer validates request inputs:

- path params from route patterns or a `path` Zod object
- URL query values on `GET` actions with a `query` schema
- JSON request bodies on mutation actions with a Zod `body` schema
- request headers with a `headers` schema

Path, query, and header values arrive as strings. Rouzer adds string parsing for
Zod number and boolean schemas in those locations, including nested object and
array schemas. JSON request bodies are parsed from the request body and then
validated as JSON values.

Rouzer does not validate handler return values just because a route uses
`$type<T>()`, `$error<T>()`, or `ndjson.$type<T>()`. Those markers are TypeScript
contracts. Validate untrusted response data where it enters your system.

## Lifecycle

```ts
// shared/routes.ts
export const routes = {
  profiles: http.resource('profiles/:id', {
    get: http.get({ response: $type<Profile>() }),
  }),
}

// server.ts
export const router = createRouter()
  .use(requestMiddleware)
  .use(routes, handlers)

// client.ts
export const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})
```

The same action key becomes:

- `handlers.profiles.get(ctx)` on the server
- `client.profiles.get(input, options)` on the client
- a route name such as `profiles.get` in client lifecycle hook events

## Rouzer And Alien Middleware

Rouzer's router extends Alien Middleware's `RequestHandler` and
`MiddlewareChain`. That means a Rouzer router is both callable as a request
handler and chainable with Alien Middleware helpers.

Use Rouzer for route contracts and HTTP handler/client behavior. Use Alien
Middleware concepts when you need request-scoped state, authentication,
environment bindings, host runtime data, response callbacks, background work, or
custom adapter contexts.

The common Alien Middleware API is re-exported from `rouzer`, including
`chain`, `toFetchHandler`, `createContext`, `filterRuntime`, `RequestContext`,
and `RequestHandler`.
