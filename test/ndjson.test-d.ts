import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'
import { expectTypeOf, test } from 'vitest'

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

test('NDJSON client actions return async iterables', () => {
  expectTypeOf<Awaited<ReturnType<typeof client.events>>>().toEqualTypeOf<
    AsyncIterable<Event>
  >()
})

test('NDJSON handlers can return sync or async iterables', () => {
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
})

test('NDJSON handlers reject non-iterable values', () => {
  createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
    // @ts-expect-error NDJSON handlers must return an iterable or Response.
    events() {
      return { id: 1, message: 'ready' }
    },
  })
})
