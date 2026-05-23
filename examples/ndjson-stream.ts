import type { HattipHandler } from '@hattip/core'
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

/**
 * Tiny Hattip adapter used only to keep this example self-contained. Real apps
 * mount the handler with a Hattip adapter for their runtime.
 */
function createLocalFetch(handler: HattipHandler): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)
    const response = await handler({
      request,
      ip: '127.0.0.1',
      platform: undefined,
      env() {
        return undefined
      },
      passThrough() {},
      waitUntil(promise) {
        void promise
      },
    })

    return response ?? new Response(null, { status: 404 })
  }
}

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []
  for await (const value of source) {
    values.push(value)
  }
  return values
}

export async function runNdjsonStreamExample() {
  const handler = createRouter({
    basePath: 'api/',
    plugins: [ndjson.routerPlugin],
  }).use(routes, {
    async *events() {
      yield { id: 1, message: 'ready' }
      yield { id: 2, message: 'done' }
    },
  })

  const client = createClient({
    baseURL: 'https://example.test/api/',
    routes,
    plugins: [ndjson.clientPlugin],
    fetch: createLocalFetch(handler),
  })

  return collect(await client.events())
}
