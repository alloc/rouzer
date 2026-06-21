import type { HattipHandler } from '@hattip/core'
import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'
import { z } from 'zod'

type Event = {
  id: number
  message: string
}

const EventFilter = z.object({
  names: z.array(z.string()),
  where: z.array(
    z.object({
      path: z.string(),
      equals: z.string(),
    })
  ),
})

export const events = http.get('events', {
  response: ndjson.$type<Event>(),
})

// NDJSON responses work for POST routes with ordinary JSON body schemas too.
export const stream = http.post('events/stream', {
  body: EventFilter,
  response: ndjson.$type<Event>(),
})

export const routes = { events, stream }

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

async function readFirst<T>(source: AsyncIterable<T>) {
  const iterator = source[Symbol.asyncIterator]()
  try {
    return (await iterator.next()).value
  } finally {
    // Closing the client iterator cancels the response body. For Rouzer NDJSON
    // routes, that cancellation reaches the server source iterator's return().
    await iterator.return?.()
  }
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
    async *stream({ body }) {
      // The POST body was parsed and validated before the stream starts.
      yield {
        id: 1,
        message: `${body.names[0]} for ${body.where[0]?.equals}`,
      }
      yield { id: 2, message: 'done' }
    },
  })

  const client = createClient({
    baseURL: 'https://example.test/api/',
    routes,
    plugins: [ndjson.clientPlugin],
    fetch: createLocalFetch(handler),
  })

  const allEvents = await collect(await client.events())

  // This call sends a JSON body, receives an AsyncIterable, and then stops after
  // one event. Request signals can also be used to cancel long-lived streams.
  const firstMatchingEvent = await readFirst(
    await client.stream({
      names: ['session.message'],
      where: [{ path: 'id', equals: 'ses_123' }],
    })
  )

  return { allEvents, firstMatchingEvent }
}
