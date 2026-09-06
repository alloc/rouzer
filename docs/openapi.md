# OpenAPI export

> Export a Zod-backed Rouzer route tree as an OpenAPI 3.1 document for external
> tools such as Dart client generators.

Import `generateOpenAPI` from the optional `rouzer/openapi` entry point. Rouzer
generates the API contract; it does not generate language-specific clients.

```ts
import * as z from 'zod'
import * as http from 'rouzer/http'
import { generateOpenAPI } from 'rouzer/openapi'

const User = z.object({ id: z.string(), name: z.string() })

const routes = {
  getUser: http.get('users/:id', {
    path: z.object({ id: z.uuid() }),
    response: {
      200: User,
      404: z.object({ code: z.literal('NOT_FOUND') }),
    },
  }),
}

const document = generateOpenAPI(routes, {
  info: { title: 'Users API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
})
```

The exporter includes:

- resource and action paths, HTTP methods, and stable dotted operation IDs
- path, query, header, and JSON request-body schemas
- every declared response status and its JSON schema
- action `summary` and `description` metadata

## Export requirements

Every exported route must declare a response. Use a Zod schema directly for an
implicit `200` response, or a status-keyed map for multiple outcomes.

```ts
const listUsers = http.get('users', {
  response: z.array(User),
})

const deleteUser = http.delete('users/:id', {
  response: {
    204: z.void(),
    404: NotFound,
  },
})
```

`z.void()` and `z.undefined()` describe an empty response. A `204` response is
also emitted without body content.

Generation fails with the affected operation ID when a contract cannot be
represented faithfully. This includes `$type<T>()`, `$error<T>()`, response
plugin markers, raw request bodies, non-representable Zod schemas, and Rouzer
patterns with optional or grouped path segments. Those declarations can still
be used normally by the router and TypeScript client.

Route parameters without a `path` schema are exported as required strings. When
a path schema is present, its fields must match parameters in the route pattern.
