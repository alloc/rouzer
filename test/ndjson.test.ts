import { createClient } from 'rouzer'
import * as http from 'rouzer/http'
import {
  decodeNdjson,
  encodeNdjson,
  ndjsonResponse,
  routerPlugin,
  $type,
} from 'rouzer/ndjson'
import { z } from 'zod'

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []
  for await (const value of source) {
    values.push(value)
  }
  return values
}

function streamFromChunks(chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function cancellableSource<T>(firstValue: T) {
  const cleanup = deferred()
  let pendingNext: ((value: IteratorResult<T>) => void) | undefined
  let yielded = false

  return {
    cleanup: cleanup.promise,
    source: {
      [Symbol.asyncIterator]() {
        return {
          next() {
            if (!yielded) {
              yielded = true
              return Promise.resolve({ done: false, value: firstValue })
            }
            return new Promise<IteratorResult<T>>(resolve => {
              pendingNext = resolve
            })
          },
          async return() {
            cleanup.resolve()
            pendingNext?.({ done: true, value: undefined as T })
            return { done: true, value: undefined as T }
          },
        }
      },
    } satisfies AsyncIterable<T>,
  }
}

function timeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timed out waiting for promise')), 50)
    }),
  ])
}

test('decodeNdjson handles chunk boundaries, CRLF, and final lines', async () => {
  await expect(
    collect(
      decodeNdjson(streamFromChunks(['{"a":1}\n{"b"', ':2}\r\n{"c":', '3}']))
    )
  ).resolves.toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
})

test('decodeNdjson reports malformed line numbers', async () => {
  const iterator = decodeNdjson(streamFromChunks(['{"ok":true}\n', '{bad}\n']))[
    Symbol.asyncIterator
  ]()

  await expect(iterator.next()).resolves.toEqual({
    done: false,
    value: { ok: true },
  })
  await expect(iterator.next()).rejects.toThrow('Invalid NDJSON at line 2')
})

test('encodeNdjson serializes values and cancels the source iterator', async () => {
  let cancelled = false

  async function* source() {
    try {
      yield { id: 1 }
      yield { id: 2 }
    } finally {
      cancelled = true
    }
  }

  const reader = encodeNdjson(source()).getReader()
  await expect(reader.read()).resolves.toEqual({
    done: false,
    value: new TextEncoder().encode('{"id":1}\n'),
  })
  await reader.cancel()

  expect(cancelled).toBe(true)
})

test('NDJSON client iterator return cancels a POST response body with a JSON body', async () => {
  const routes = {
    stream: http.post('stream', {
      body: z.object({
        names: z.array(z.string()),
        where: z.array(
          z.object({
            path: z.string(),
            equals: z.string(),
          })
        ),
      }),
      response: $type<{ id: number }>(),
    }),
  }
  const bodyCancelled = deferred()
  const client = createClient({
    baseURL: 'http://test.local',
    routes,
    plugins: [
      { id: routerPlugin.id, decode: response => decodeNdjson(response.body!) },
    ],
    fetch: vi.fn(async (_url, init) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(
        JSON.stringify({
          names: ['session.message'],
          where: [{ path: 'id', equals: 'ses_123' }],
        })
      )

      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"id":1}\n'))
          },
          cancel() {
            bodyCancelled.resolve()
          },
        }),
        {
          headers: {
            'content-type': 'application/x-ndjson; charset=utf-8',
          },
        }
      )
    }),
  })

  const iterator = (
    await client.stream({
      names: ['session.message'],
      where: [{ path: 'id', equals: 'ses_123' }],
    })
  )[Symbol.asyncIterator]()

  await expect(iterator.next()).resolves.toEqual({
    done: false,
    value: { id: 1 },
  })
  await iterator.return?.()
  await expect(timeout(bodyCancelled.promise)).resolves.toBeUndefined()
})

test('router NDJSON response cancels the source iterator when the request aborts', async () => {
  const controller = new AbortController()
  const request = new Request('http://test.local/stream', {
    signal: controller.signal,
  })
  const { cleanup, source } = cancellableSource({ id: 1 })
  const response = await routerPlugin.encode(source, {
    marker: $type<{ id: number }>(),
    request,
  })
  const reader = response.body!.getReader()

  await expect(reader.read()).resolves.toEqual({
    done: false,
    value: new TextEncoder().encode('{"id":1}\n'),
  })
  const pendingRead = reader.read()
  controller.abort()

  await expect(timeout(cleanup)).resolves.toBeUndefined()
  await expect(pendingRead).resolves.toEqual({
    done: true,
    value: undefined,
  })
})

test('encodeNdjson rejects values that are not JSON texts', async () => {
  const reader = encodeNdjson([undefined]).getReader()

  await expect(reader.read()).rejects.toThrow(
    'NDJSON items must serialize to a JSON text'
  )
})

test('ndjsonResponse sets the NDJSON content type by default', async () => {
  const response = ndjsonResponse([{ ok: true }])

  expect(response.headers.get('content-type')).toBe(
    'application/x-ndjson; charset=utf-8'
  )
  await expect(response.text()).resolves.toBe('{"ok":true}\n')
})
