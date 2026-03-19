# rouzer

Type-safe routes shared by your server and client, powered by `zod` (input validation + transforms), `@remix-run/route-pattern` (URL matching), and `alien-middleware` (typed middleware chaining). The router output is intended to be used with `@hattip/core` adapters.

## Install

```sh
pnpm add rouzer zod
```

Everything is imported directly from `rouzer`.

## Define routes (shared)

```ts
// routes.ts
import * as z from 'zod'
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
```

Supported route methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `ALL`.

The following request parts can be validated with Zod:

- `path`
- `query`
- `body`
- `headers`

Zod validation happens on both the server and client. Client validation runs
before `fetch`, so invalid requests fail locally without sending a network
request.

On the server, `path`, `query`, and `headers` values are parsed from strings and
coerced to `number` and `boolean` when the schema expects those types. Request
`body` values are validated as JSON without this coercion step.

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
  debug: process.env.NODE_ENV === 'development',
})
  .use(middlewares)
  .use(routes, {
    helloRoute: {
      GET(ctx) {
        const message = `Hello, ${ctx.path.name}${
          ctx.query.excited ? '!' : '.'
        }`
        return { message }
      },
    },
  })
```

Handlers can either return a plain JSON-serializable value or a `Response`.
Returning a `Response` gives you full control over status, headers, and body.

## Router options

```ts
export const handler = createRouter({
  basePath: 'api/',
  cors: {
    allowOrigins: [
      'example.net',
      'https://*.example.com',
      '*://localhost:3000',
    ],
  },
  debug: process.env.NODE_ENV === 'development',
}).use(routes, {
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
- You can define a route-level `OPTIONS` handler to customize preflight
  responses; if it returns nothing, Rouzer falls back to the built-in preflight
  response.
- `cors.allowOrigins` restricts preflight requests to a list of origins (default is to allow any origin).
  - Wildcards are supported for protocol and subdomain; the protocol is optional and defaults to `https`.
- `debug` adds an `X-Route-Name` response header for matched routes and includes
  more specific validation error messages in `400` responses.
- `ALL` handlers act as a fallback when a route does not define the incoming HTTP
  method explicitly.
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

### Default headers

You can attach headers to every request:

```ts
const client = createClient({
  baseURL: '/api/',
  headers: {
    authorization: `Bearer ${token}`,
  },
})
```

Per-request headers are merged on top of these defaults.

### Custom fetch

You can also pass a custom fetch implementation:

```ts
const client = createClient({
  baseURL: '/api/',
  fetch: myFetch,
})
```

### Custom JSON error handling

By default, `client.json()` throws for non-2xx responses. If the response body
is JSON, its properties are copied onto the thrown `Error`.

You can override that behavior with `onJsonError`:

```ts
const client = createClient({
  baseURL: '/api/',
  onJsonError(response) {
    if (response.status === 404) {
      return Response.json({ message: 'not found' })
    }
    return response
  },
})
```

### Shorthand route methods

Optionally pass your routes map to `createClient` to get per-route methods on the client:

```ts
import * as routes from './routes'

const client = createClient({
  baseURL: '/api/',
  routes, // <–– Pass the routes
})

// Shorthand methods now available:
await client.fooRoute.GET()
// …same as the longhand:
await client.json(routes.fooRoute.GET())
```

Routes that define a `response` type will call `client.json()` under the hood and return the parsed value; routes without one return the raw `Response`:

```ts
// helloRoute has a response schema, so you get the parsed payload
const { message } = await client.helloRoute.GET({
  path: { name: 'world' },
})

// imagine pingRoute has no response schema; you get a Response object
const pingResponse = await client.pingRoute.GET({})
const pingText = await pingResponse.text()
```

### Type helpers

Rouzer also exports utility types for route inference:

```ts
import type {
  InferRouteBody,
  InferRouteMethodBody,
  InferRouteResponse,
} from 'rouzer'

type CreateUserBody = InferRouteBody<typeof createUserRoute.POST>
type CreateUserBody2 = InferRouteMethodBody<typeof createUserRoute, 'POST'>
type HelloResponse = InferRouteResponse<typeof helloRoute.methods.GET>
```

## Add an endpoint

1. Declare it in `routes.ts` with `route(…)` and `zod` schemas.
2. Implement the handler in your router assembly with `createRouter(…).use(routes, { … })`.
3. Call it from the client with the generated helper via `client.json` or `client.request`.
