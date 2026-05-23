import {
  createResponsePluginMarker,
  type ClientResponsePlugin,
  type ResponsePluginMarker,
  type RouterResponsePlugin,
} from './response.js'

const codecId = 'rouzer/ndjson'

/** Values accepted by Rouzer's NDJSON response encoder. */
export type NdjsonSource<T = unknown> = Iterable<T> | AsyncIterable<T>

/**
 * Create a compile-time marker for newline-delimited JSON response items.
 *
 * @remarks The returned marker is handled by `clientPlugin` in clients and
 * `routerPlugin` in routers. Generated client action functions resolve to an
 * `AsyncIterable<T>`, while route handlers may return either an `Iterable<T>`
 * or an `AsyncIterable<T>`.
 */
export function $type<T>(): ResponsePluginMarker<
  AsyncIterable<T>,
  NdjsonSource<T>,
  typeof codecId
> {
  return createResponsePluginMarker(codecId)
}

/** Client plugin that decodes successful NDJSON responses. */
export const clientPlugin: ClientResponsePlugin = {
  id: codecId,
  decode(response) {
    if (!response.body) {
      throw new Error('NDJSON response has no body')
    }
    return decodeNdjson(response.body)
  },
}

/** Router plugin that encodes handler results as NDJSON responses. */
export const routerPlugin: RouterResponsePlugin = {
  id: codecId,
  encode(value) {
    return ndjsonResponse(value as NdjsonSource)
  },
}

/**
 * Encode an iterable of values as a newline-delimited JSON byte stream.
 *
 * @remarks Each yielded value is serialized with `JSON.stringify` and followed
 * by `\n`. Values that cannot be represented as a JSON text, such as
 * `undefined`, cause the stream to error when read.
 */
export function encodeNdjson(source: NdjsonSource): ReadableStream<Uint8Array> {
  const iterator = getAsyncIterator(source)
  const encoder = new TextEncoder()

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await iterator.next()
      if (done) {
        controller.close()
        return
      }

      const line = JSON.stringify(value)
      if (line === undefined) {
        throw new TypeError(
          'NDJSON items must serialize to a JSON text; received undefined'
        )
      }
      controller.enqueue(encoder.encode(`${line}\n`))
    },
    async cancel(reason) {
      await iterator.return?.(reason)
    },
  })
}

/**
 * Decode a newline-delimited JSON byte stream.
 *
 * @remarks UTF-8 chunks may split JSON lines. Both `\n` and `\r\n` line endings
 * are accepted, and a final line does not need a trailing newline. Malformed
 * lines throw a `SyntaxError` that includes the 1-based line number.
 */
export async function* decodeNdjson<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0
  let doneReading = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        doneReading = true
        break
      }

      buffer += decoder.decode(value, { stream: true })
      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = stripCarriageReturn(buffer.slice(0, newlineIndex))
        buffer = buffer.slice(newlineIndex + 1)
        lineNumber += 1
        yield parseNdjsonLine<T>(line, lineNumber)
      }
    }

    if (buffer.length > 0) {
      lineNumber += 1
      yield parseNdjsonLine<T>(stripCarriageReturn(buffer), lineNumber)
    }
  } finally {
    if (!doneReading) {
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
}

/**
 * Create a `Response` whose body is encoded as newline-delimited JSON.
 *
 * @remarks The response defaults to
 * `content-type: application/x-ndjson; charset=utf-8` unless the caller supplies
 * a content type in `init.headers`.
 */
export function ndjsonResponse<T>(
  source: NdjsonSource<T>,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/x-ndjson; charset=utf-8')
  }

  return new Response(encodeNdjson(source), {
    ...init,
    headers,
  })
}

function getAsyncIterator<T>(source: NdjsonSource<T>): AsyncIterator<T> {
  const asyncIterator = (source as AsyncIterable<T>)[Symbol.asyncIterator]?.()
  if (asyncIterator) {
    return asyncIterator
  }

  const iterator = (source as Iterable<T>)[Symbol.iterator]?.()
  if (iterator) {
    return {
      next() {
        return Promise.resolve(iterator.next())
      },
      async return() {
        iterator.return?.()
        return { done: true, value: undefined as T }
      },
    }
  }

  throw new TypeError('NDJSON source must be iterable')
}

function stripCarriageReturn(line: string) {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

function parseNdjsonLine<T>(line: string, lineNumber: number): T {
  try {
    return JSON.parse(line) as T
  } catch (cause) {
    const error = new SyntaxError(
      `Invalid NDJSON at line ${lineNumber}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    )
    ;(error as Error & { cause?: unknown }).cause = cause
    throw error
  }
}
