# Typed client

`createClient({ baseURL, routes })` creates a typed fetch client from the same
route tree used by the server.

```ts
const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

const profile = await client.profiles.get({
  id: '42',
  includePosts: true,
})
```

The returned client mirrors resources and actions from the route tree. Each
action function validates input before calling `fetch`.

## Configuration

```ts
const client = createClient({
  baseURL: new URL('/api/', window.location.origin).href,
  routes,
  headers: {
    'content-type': 'application/json',
  },
  fetch: globalThis.fetch,
  plugins: [ndjson.clientPlugin],
  onJsonError(response) {
    return response.json()
  },
  clientHook(event) {
    console.log(event.type, event.routeName)
  },
})
```

| Option        | Purpose                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `baseURL`     | Absolute base URL used to build request URLs. A trailing slash is added when missing. |
| `routes`      | Shared HTTP route tree. Required.                                                     |
| `headers`     | Default headers merged into every request.                                            |
| `fetch`       | Custom fetch implementation for tests or non-browser runtimes.                        |
| `plugins`     | Client response plugins such as `ndjson.clientPlugin`.                                |
| `onJsonError` | Custom handler for non-2xx responses not declared in a response map.                  |
| `clientHook`  | Best-effort lifecycle observer for generated action calls.                            |

The returned client exposes the original options as `client.clientConfig`, so a
route action named `config` remains available as `client.config(...)`.

## Action Arguments

Generated action functions use a flat first argument for path, query, and JSON
body fields.

```ts
export const updateProfile = http.patch('profiles/:id', {
  body: z.object({
    name: z.string(),
  }),
  response: $type<Profile>(),
})

await client.updateProfile({
  id: '42',
  name: 'Ada',
})
```

Per-request `RequestInit` options are the second argument. Rouzer reserves
`method` and owns JSON body encoding. Headers are typed from the route header
schema when one exists.

```ts
await client.profiles.get(
  { id: '42', includePosts: false },
  {
    signal: abortController.signal,
    headers: { 'x-request-id': 'docs' },
  }
)
```

Avoid duplicate keys across path, query, and JSON body schemas. The flat client
input cannot distinguish duplicate field names from different request
locations.

## Raw Body Routes

For raw-body routes with path or query input, pass the `BodyInit` as
`options.body`.

```ts
await client.uploadAvatar(
  { id: '42' },
  { body: file, headers: { 'content-type': file.type } }
)
```

For raw-body routes without route input, pass the body as the first argument.

```ts
await client.upload(file, {
  headers: { 'content-type': file.type },
})
```

Rouzer does not JSON encode or validate raw bodies.

## Response Results

Generated action return types depend on the action response schema:

| Route response            | Client result                                                    |
| ------------------------- | ---------------------------------------------------------------- |
| No `response` marker      | Raw `Response`.                                                  |
| `response: $type<T>()`    | Parsed JSON typed as `T`.                                        |
| Status-keyed response map | Tuple union: `[null, value, status]` or `[error, null, status]`. |
| Response plugin marker    | Plugin-decoded value, such as `AsyncIterable<T>` for NDJSON.     |

Non-2xx responses reject unless the status is declared in a response map or
`onJsonError` returns a value.

## Error Handling

By default, undeclared non-2xx responses throw an `Error` with the HTTP status
in the message. If the response has a JSON content type, Rouzer copies parsed
JSON properties onto the thrown error.

Use `onJsonError` to override that behavior:

```ts
const client = createClient({
  baseURL,
  routes,
  async onJsonError(response) {
    return {
      status: response.status,
      body: await response.json(),
    }
  },
})
```

Rouzer returns the `onJsonError` result as-is. It does not automatically parse a
`Response` returned by `onJsonError`.

## Lifecycle Hooks

Use `clientHook` for observability without wrapping every generated action.

```ts
const client = createClient({
  baseURL,
  routes,
  clientHook(event) {
    if (event.type === 'request.success') {
      console.log(event.routeName, event.durationMs)
    }
  },
})
```

Rouzer emits:

- `request.start` before client-side validation
- `request.success` when the generated action resolves
- `request.error` when the generated action rejects

Each event includes an opaque `opId`, `routeName`, HTTP `method`,
`pathPattern`, and original `payload`. Terminal events include `durationMs` and
either `response` or `error`. If an HTTP response was received, terminal events
also include `status`.

Hook errors are swallowed. Lifecycle hooks are observability-only and must not
change request behavior.

For streaming response plugins, `request.success` is emitted when the generated
action resolves to the stream object. Errors that happen while consuming the
stream are outside the first lifecycle hook surface.

## Testing With Local Fetch

Rouzer handlers accept a request context, while `fetch` accepts `(input, init)`.
Use `toFetchHandler` plus a small wrapper in tests.

```ts
import { toFetchHandler, type RequestHandler } from 'rouzer'

function createLocalFetch(handler: RequestHandler): typeof fetch {
  const fetchHandler = toFetchHandler(handler)
  return (input, init) => fetchHandler(new Request(input, init))
}

const client = createClient({
  baseURL: 'https://example.test/api/',
  routes,
  fetch: createLocalFetch(router),
})
```
