import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

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
  response: ndjson.$type<Event>(),
})

const routes = { events }

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
  plugins: [ndjson.clientPlugin],
})

type _ClientActionReturnsAsyncIterable = Assert<
  Equal<Awaited<ReturnType<typeof client.events>>, AsyncIterable<Event>>
>

createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  events() {
    return (async function* () {
      yield { id: 1, message: 'ready' }
    })()
  },
})

createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  events() {
    return [{ id: 1, message: 'ready' }]
  },
})

createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  // @ts-expect-error NDJSON handlers must return an iterable or Response.
  events() {
    return { id: 1, message: 'ready' }
  },
})
