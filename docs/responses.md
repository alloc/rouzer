# Responses, errors, and plugins

> Choose whether callers receive typed JSON, a raw Web `Response`, a declared
> status tuple, or a plugin-decoded value.

Rouzer response schemas shape handler return types and generated client result
types.

> [!IMPORTANT]
> Response markers do not validate handler return values at runtime. They are
> TypeScript contracts between handlers and generated clients.

## Plain JSON Success

Use `$type<T>()` for JSON responses that should be typed on the server and
client.

```ts
export const getProfile = http.get('profiles/:id', {
  response: $type<Profile>(),
})

createRouter().use(
  { getProfile },
  {
    getProfile(ctx) {
      return { id: ctx.path.id, name: 'Ada' }
    },
  }
)

const profile = await client.getProfile({ id: '42' })
```

Handlers may return a plain JSON-serializable value or a custom `Response`.
Plain values are sent with `Response.json(value)`.

## Raw Response

If an action has no `response` marker, generated client action functions resolve
to the raw `Response`.

```ts
export const download = http.get('exports/:id', {})

const response = await client.download({ id: 'exp_123' })
const blob = await response.blob()
```

Return a `Response` from handlers for redirects, custom headers, binary bodies,
non-JSON content, or custom status handling.

## Declared Error Responses

Use `$error<T>()` inside a response map when an error status is part of the route
contract and callers should handle it as typed data instead of an exception.

```ts
type User = { id: string; name: string }
type NotFound = { code: 'NOT_FOUND'; message: string }

export const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    404: $error<NotFound>(),
  },
})
```

Response-map handlers can return a default success value directly or use helper
methods.

```ts
createRouter().use(
  { getUser },
  {
    getUser(ctx) {
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

Generated clients resolve declared statuses as tuples:

- success: `[null, value, status]`
- error: `[error, null, status]`

```ts
const [error, user, status] = await client.getUser({ id: 'missing' })

if (status === 404) {
  console.log(error.message)
} else {
  console.log(user.name)
}
```

Declared error statuses do not reject the client promise. Undeclared statuses
still go through `onJsonError` or throw the default error.

## Multiple Success Statuses

When a response map declares multiple success statuses, return a plain value for
the default success status or use `ctx.success(status, body)` to choose a
specific declared success status.

```ts
export const createUser = http.post('users', {
  body: createUserSchema,
  response: {
    200: $type<User>(),
    201: $type<User>(),
    409: $error<Conflict>(),
  },
})

createRouter().use(
  { createUser },
  {
    createUser(ctx) {
      if (alreadyExists(ctx.body.email)) {
        return ctx.error(409, {
          code: 'CONFLICT',
          message: 'Email already exists',
        })
      }

      return ctx.success(201, create(ctx.body))
    },
  }
)
```

The helpers only accept statuses and bodies declared in the map.

## Response Plugins

Response plugins add non-JSON response codecs without changing route matching or
request validation. A plugin has:

- a compile-time response marker
- a router plugin that encodes handler results into `Response` objects
- a client plugin that decodes successful `Response` objects into client results

NDJSON is the built-in example:

```ts
export const events = http.get('events', {
  response: ndjson.$type<Event>(),
})

createRouter({
  plugins: [ndjson.routerPlugin],
})

createClient({
  baseURL,
  routes,
  plugins: [ndjson.clientPlugin],
})
```

> [!IMPORTANT]
> Register the matching response plugin on both the router and client. Rouzer
> fails fast when attaching routes with an unregistered marker instead of
> falling back to JSON.

Plugin markers can be used directly as an action response or as success entries
in a response map. `$error<T>()` entries are JSON error responses.

## Runtime Validation Boundary

`$type<T>()`, `$error<T>()`, and plugin markers are TypeScript contracts. Rouzer
does not re-check handler return values against those types at the server
boundary.

Validate untrusted data where it enters your system, such as:

- external API clients
- database decoders
- queue/event consumers
- form-data or file-processing layers
- UI/client boundaries that consume untrusted responses
