# rouzer

Type-safe routes shared by your server and client, powered by `zod/mini` (input validation + transforms), `@remix-run/route-pattern` (URL matching), and `alien-middleware` (typed middleware chaining). The router output is intended to be used with `@hattip/core` adapters.

## Install

```sh
pnpm add rouzer zod
```

Everything is imported directly from `rouzer`.

## Define routes (shared)

```ts
// routes.ts
import * as z from 'zod/mini'
import { $type, route } from 'rouzer'

export const helloRoute = route('hello/:name', {
  GET: {
    query: z.object({
      excited: z.optional(z.boolean()),
    }),
    // The response is only type-checked at compile time.
    response: $type<{ message: string }>(),
  },
})

export const routes = { helloRoute }
```

The following request parts can be validated with Zod:

- `path`
- `query`
- `body`
- `headers`

Zod validation happens on both the server and client.

## Route URL patterns

Rouzer uses `@remix-run/route-pattern` for matching and generation. Patterns can include:

- Pathname-only patterns like `blog/:slug` (default).
- Full URLs with protocol/hostname/port like `https://:store.shopify.com/orders`.
- Dynamic segments with `:param` names (valid JS identifiers), including multiple params in one segment like `v:major.:minor`.
- Optional segments wrapped in parentheses, which can be nested like `api(/v:major(.:minor))`.
- Wildcards with `*name` (captured) or `*` (uncaptured) for multi-segment paths like `assets/*path` or `files/*`.
- Query matching with `?` to require parameters or exact values like `search?q` or `search?q=routing`.

## Server router

```ts
import { chain, createRouter } from 'rouzer'
import { routes } from './routes'

const middlewares = chain().use(ctx => {
  // An example middleware. For more info, see https://github.com/alien-rpc/alien-middleware#readme
  return {
    db: postgres(ctx.env('POSTGRES_URL')),
  }
})

export const handler = createRouter({
  routes,
  middlewares,
  debug: process.env.NODE_ENV === 'development',
})({
  helloRoute: {
    GET(ctx) {
      const message = `Hello, ${ctx.path.name}${ctx.query.excited ? '!' : '.'}`
      return { message }
    },
  },
})
```

## Router options

```ts
export const handler = createRouter({
  routes,
  middlewares,
  basePath: 'api/',
  cors: {
    allowOrigins: ['example.net', 'https://*.example.com', '*://localhost:3000'],
  },
  debug: process.env.NODE_ENV === 'development',
})({
  helloRoute: {
    GET(ctx) {
      const message = `Hello, ${ctx.path.name}${ctx.query.excited ? '!' : '.'}`
      return { message }
    },
  },
})
```

- `basePath` is prepended to every route (leading/trailing slashes are trimmed).
- CORS preflight (`OPTIONS`) is handled automatically for matched routes.
- `cors.allowOrigins` restricts preflight requests to a list of origins (default is to allow any origin).
  - Wildcards are supported for protocol and subdomain; the protocol is optional and defaults to `https`.
- If you rely on `Cookie` or `Authorization` request headers, you must set
  `Access-Control-Allow-Credentials` in your handler.

## Client wrapper

```ts
import { createClient } from 'rouzer'
import { helloRoute } from './routes'

const client = createClient({ baseURL: '/api/' })

const { message } = await client.json(
  helloRoute.GET({ path: { name: 'world' }, query: { excited: true } })
)

// If you want the Response object, use `client.request` instead.
const response = await client.request(
  helloRoute.GET({ path: { name: 'world' } })
)

const { message } = await response.json()
```

## Add an endpoint

1. Declare it in `routes.ts` with `route(...)` and `zod/mini` schemas.
2. Implement the handler in your router assembly with `createRouter(…)({ ... })`.
3. Call it from the client with the generated helper via `client.json` or `client.request`.
