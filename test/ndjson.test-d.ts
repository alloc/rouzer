import { $ndjson, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

type Assert<T extends true> = T

type Event = {
  id: number
  message: string
}

const events = http.get('events', {
  response: $ndjson<Event>(),
})

const routes = { events }

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

type _ClientActionReturnsAsyncIterable = Assert<
  Equal<Awaited<ReturnType<typeof client.events>>, AsyncIterable<Event>>
>

async function lowLevelNdjsonReturnsAsyncIterable() {
  const stream = await client.ndjson(events.request())
  type _LowLevelNdjsonReturnsAsyncIterable = Assert<
    Equal<typeof stream, AsyncIterable<Event>>
  >
}

createRouter().use(routes, {
  events() {
    return (async function* () {
      yield { id: 1, message: 'ready' }
    })()
  },
})

createRouter().use(routes, {
  // @ts-expect-error NDJSON handlers must return an async iterable or Response.
  events() {
    return { id: 1, message: 'ready' }
  },
})
