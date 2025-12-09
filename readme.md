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
