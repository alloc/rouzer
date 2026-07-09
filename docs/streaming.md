# NDJSON streaming

> Stream a sequence of JSON values through a typed route while preserving
> incremental delivery, cancellation, and explicit error modeling.

Rouzer includes a response plugin for newline-delimited JSON response streams.
Use it when a route should send a sequence of JSON values without buffering the
whole response.

```ts
import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

type Event = {
  id: number
  message: string
}

export const events = http.get('events', {
  response: ndjson.$type<Event>(),
})

export const routes = { events }

const router = createRouter({
  plugins: [ndjson.routerPlugin],
}).use(routes, {
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

Handlers return an `Iterable<T>` or `AsyncIterable<T>`. The client action
resolves to an `AsyncIterable<T>`.

## Plugin Registration

> [!IMPORTANT]
> Register both sides when a route tree contains `ndjson.$type<T>()`:

> - `ndjson.routerPlugin` in `createRouter({ plugins })`
> - `ndjson.clientPlugin` in `createClient({ plugins })`

Rouzer fails fast if a route uses a response plugin marker and the matching
plugin is not registered.

## POST Streams

NDJSON is a response codec. Requests still use normal Rouzer request schemas.
A route can receive a JSON body and return an NDJSON stream.

```ts
export const streamEvents = http.post('events/stream', {
  body: z.object({
    topic: z.string(),
  }),
  response: ndjson.$type<Event>(),
})

createRouter({ plugins: [ndjson.routerPlugin] }).use(
  { streamEvents },
  {
    async *streamEvents(ctx) {
      yield { id: 1, message: `topic:${ctx.body.topic}` }
    },
  }
)
```

Use `http.rawBody()` only when the request body itself should pass through as a
`BodyInit`.

## Encoding And Decoding

`ndjson.routerPlugin` serializes each yielded value with `JSON.stringify` and
adds a newline. The response content type defaults to
`application/x-ndjson; charset=utf-8`.

`ndjson.clientPlugin` decodes UTF-8 chunks, accepts `\n` and `\r\n` line endings,
and parses each line with `JSON.parse`. A final line does not need a trailing
newline. Malformed JSON throws a `SyntaxError` with the line number.

> [!NOTE]
> Streamed items are not validated against a Zod schema. If item validation is
> needed, validate before yielding on the server or while consuming on the
> client.

## Cancellation

If a client aborts the request signal or stops iteration early by breaking from
`for await` or calling the iterator's `return()`, Rouzer cancels the response
body and calls the server source iterator's `return()`.

> [!TIP]
> Make waits for future events abort-aware when cleanup must run while an
> awaited operation is still pending.

```ts
async function readFirst<T>(source: AsyncIterable<T>) {
  const iterator = source[Symbol.asyncIterator]()
  try {
    return (await iterator.next()).value
  } finally {
    await iterator.return?.()
  }
}
```

## Stream Errors

> [!NOTE]
> Rouzer does not convert handler or generator failures into extra NDJSON items.
> If an async generator throws after the response starts, the response stream
> errors and the client's `for await` loop throws.

Model application-level stream errors as part of your item type when clients
should receive them as data.

```ts
type StreamItem =
  | { type: 'event'; id: number; message: string }
  | { type: 'error'; message: string }
```

The [complete runnable NDJSON example](https://github.com/alloc/rouzer/blob/main/examples/ndjson-stream.ts)
includes the shared route, router, client, and stream consumption loop.
