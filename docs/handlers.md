# Routers and handlers

`createRouter()` returns a fetch-compatible Rouzer handler with Alien Middleware
chain methods. Use it to compose middleware and attach route trees.

```ts
import { createRouter } from 'rouzer'

export const router = createRouter({ basePath: 'api/' })
  .use(requestMiddleware)
  .use(routes, handlers)
```

The router is also a `RequestHandler`, so it can be mounted with
`toFetchHandler(router)` or adapter-specific Alien Middleware helpers.

## Handler Maps

The handler object mirrors the route tree. Resource nodes become nested objects.
Action nodes become handler functions.

```ts
export const routes = {
  profiles: http.resource('profiles/:id', {
    get: http.get({ response: $type<Profile>() }),
    update: http.patch({
      body: updateProfileSchema,
      response: $type<Profile>(),
    }),
    posts: http.resource('posts', {
      list: http.get({ response: $type<Post[]>() }),
    }),
  }),
}

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

## Handler Context

Handlers receive the Alien Middleware context plus values inferred from the
matched route.

`GET` handlers receive:

- `ctx.path`
- `ctx.query`
- `ctx.headers`

Mutation handlers receive:

- `ctx.path`
- `ctx.body`
- `ctx.headers`

All handlers also receive middleware-provided properties and base context fields
such as `ctx.request`, `ctx.url`, `ctx.host`, `ctx.env(...)`,
`ctx.waitUntil(...)`, `ctx.setHeader(...)`, and `ctx.onResponse(...)`.

```ts
const requestInfo = chain().use(ctx => ({
  requestId: ctx.request.headers.get('x-request-id') ?? 'local',
}))

createRouter()
  .use(requestInfo)
  .use(routes, {
    getProfile(ctx) {
      return {
        id: ctx.path.id,
        requestId: ctx.requestId,
      }
    },
  })
```

## Validation Order

For a matched route, Rouzer validates before the handler runs:

1. path params, if a `path` schema is declared
2. headers, if a `headers` schema is declared
3. query string, for `GET` actions with a `query` schema
4. JSON body, for mutation actions with a non-raw `body` schema

If validation fails, Rouzer returns a `400` JSON response and does not call the
handler. In `debug` mode, validation responses include more specific Zod error
messages.

If no `path` schema is declared, `ctx.path` is inferred from the route pattern
and contains string params.

## Return Values

Handlers can return:

- a plain value, which Rouzer sends with `Response.json(value)`
- a Web `Response`, which Rouzer passes through unchanged
- `ctx.error(status, body)` for a declared error response-map entry
- `ctx.success(status, body)` for a declared non-default success response-map
  entry
- a response-plugin value, such as an NDJSON iterable, when the route response
  marker and router plugin match

Return a `Response` when you need custom status codes, headers, redirects,
non-JSON payloads, or hand-written error bodies.

## Response Maps In Handlers

Routes with a status-keyed response map add `ctx.error` and `ctx.success`
helpers.

```ts
export const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    201: $type<User>(),
    404: $error<NotFound>(),
  },
})

createRouter().use(
  { getUser },
  {
    getUser(ctx) {
      if (ctx.path.id === 'created') {
        return ctx.success(201, { id: 'created', name: 'Grace' })
      }

      const user = users.get(ctx.path.id)
      if (!user) {
        return ctx.error(404, {
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }

      return user
    },
  }
)
```

The helpers only accept statuses and body types declared in the response map.

## Router Configuration

`createRouter(config)` accepts:

| Option              | Purpose                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `basePath`          | Prepends a normalized path prefix to all route patterns.                                                       |
| `debug`             | Adds matched-route debug headers, logs missing route handlers, and includes more specific validation messages. |
| `plugins`           | Router response plugins such as `ndjson.routerPlugin`.                                                         |
| `cors.allowOrigins` | Restricts requests with an `Origin` header.                                                                    |

```ts
createRouter({
  basePath: 'api/',
  debug: process.env.NODE_ENV === 'development',
  cors: {
    allowOrigins: ['example.net', 'https://*.example.com'],
  },
})
```

When an allowed request includes an `Origin` header, Rouzer sets
`Access-Control-Allow-Origin` to that origin. For preflight requests, Rouzer
returns `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and
`Access-Control-Allow-Headers`.

Rouzer does not automatically set `Access-Control-Allow-Credentials`. Set that
header yourself when credentialed cross-origin requests need it.

## Middleware Ordering

Attach middleware before route handlers that depend on it.

```ts
createRouter().use(authMiddleware).use(routes, secureHandlers)
```

Middleware attached after a route tree only runs if an earlier route handler
does not produce a response. Most applications put shared middleware before
route registration.

Use a middleware `Response` return for cross-cutting rejection, such as auth or
rate limits. Use route handlers for route-specific application results.
