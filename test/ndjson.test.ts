import { decodeNdjson, encodeNdjson, ndjsonResponse } from 'rouzer'

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
