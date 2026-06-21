import {
  createResponsePluginMarker,
  type ClientResponsePlugin,
  type ResponsePluginMarker,
  type RouterResponsePlugin,
} from './response.js'

const codecId = 'rouzer/ndjson'

/** Values accepted by Rouzer's NDJSON response encoder. */
export type NdjsonSource<T = unknown> = Iterable<T> | AsyncIterable<T>

/** Options for Rouzer's NDJSON response encoder. */
export type NdjsonEncodeOptions = {
  /** Signal whose abort cancels the source iterator and closes the stream. */
  signal?: AbortSignal
}

/**
 * Create a compile-time marker for newline-delimited JSON response items.
 *
 * @remarks The returned marker is handled by `clientPlugin` in clients and
 * `routerPlugin` in routers. Generated client action functions resolve to an
 * `AsyncIterable<T>`, while route handlers may return either an `Iterable<T>`
 * or an `AsyncIterable<T>`. Rouzer does not validate streamed items at runtime.
 */
export function $type<T>(): ResponsePluginMarker<
  AsyncIterable<T>,
  NdjsonSource<T>,
  typeof codecId
> {
  return createResponsePluginMarker(codecId)
}

/**
 * Client plugin that decodes successful NDJSON responses.
 *
 * @remarks Register this plugin with `createClient({ plugins })` when the route
 * tree contains `response: ndjson.$type<T>()` markers.
 */
export const clientPlugin: ClientResponsePlugin = {
  id: codecId,
  decode(response) {
    if (!response.body) {
      throw new Error('NDJSON response has no body')
    }
    return decodeNdjson(response.body)
  },
}

/**
 * Router plugin that encodes handler results as NDJSON responses.
 *
 * @remarks Register this plugin with `createRouter({ plugins })` when the route
 * tree contains `response: ndjson.$type<T>()` markers. Handler or generator
 * errors are not encoded as NDJSON items; model application-level errors in the
 * item type when clients should receive them as data.
 */
export const routerPlugin: RouterResponsePlugin = {
  id: codecId,
  encode(value, { request }) {
    return ndjsonResponse(value as NdjsonSource, {
      signal: request.signal,
    })
  },
}

/**
 * Encode an iterable of values as a newline-delimited JSON byte stream.
 *
 * @remarks Each yielded value is serialized with `JSON.stringify` and followed
 * by `\n`. Values that cannot be represented as a JSON text, such as
 * `undefined`, cause the stream to error when read. When `options.signal`
 * aborts, the source iterator's `return()` method is called and the stream is
 * closed.
 */
export function encodeNdjson(
  source: NdjsonSource,
  options: NdjsonEncodeOptions = {}
): ReadableStream<Uint8Array> {
  const iterator = getAsyncIterator(source)
  const encoder = new TextEncoder()
  const { signal } = options
  let cancelled = false
  let cleanup: Promise<void> | undefined
  let abortHandler: (() => void) | undefined

  function removeAbortHandler() {
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler)
      abortHandler = undefined
    }
  }

  function cancelIterator(reason?: unknown) {
    cancelled = true
    removeAbortHandler()
    cleanup ??= Promise.resolve(iterator.return?.(reason)).then(() => {})
    return cleanup
  }

  return new ReadableStream({
    start(controller) {
      if (!signal) {
        return
      }

      abortHandler = () => {
        void cancelIterator(signal.reason).catch(() => {})
        try {
          controller.close()
        } catch {}
      }

      if (signal.aborted) {
        abortHandler()
        return
      }
      signal.addEventListener('abort', abortHandler, { once: true })
    },
    async pull(controller) {
      if (cancelled) {
        controller.close()
        return
      }

      const { done, value } = await iterator.next()
      if (cancelled) {
        return
      }
      if (done) {
        removeAbortHandler()
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
      await cancelIterator(reason)
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
export function decodeNdjson<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0
  let closed = false
  let doneReading = false
  let readerReleased = false

  function releaseReader() {
    if (!readerReleased) {
      readerReleased = true
      reader.releaseLock()
    }
  }

  async function cancelReader(reason?: unknown) {
    if (!doneReading) {
      await reader.cancel(reason).catch(() => {})
    }
    releaseReader()
  }

  async function parseNextLine(line: string): Promise<IteratorResult<T>> {
    try {
      lineNumber += 1
      return {
        done: false,
        value: parseNdjsonLine<T>(stripCarriageReturn(line), lineNumber),
      }
    } catch (error) {
      closed = true
      await cancelReader(error)
      throw error
    }
  }

  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          if (closed) {
            return { done: true, value: undefined as T }
          }

          while (true) {
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex !== -1) {
              const line = buffer.slice(0, newlineIndex)
              buffer = buffer.slice(newlineIndex + 1)
              return parseNextLine(line)
            }

            if (doneReading) {
              closed = true
              releaseReader()
              if (buffer.length > 0) {
                const line = buffer
                buffer = ''
                return parseNextLine(line)
              }
              return { done: true, value: undefined as T }
            }

            let chunk: ReadableStreamReadResult<Uint8Array>
            try {
              chunk = await reader.read()
            } catch (error) {
              closed = true
              releaseReader()
              throw error
            }
            if (closed) {
              return { done: true, value: undefined as T }
            }
            if (chunk.done) {
              buffer += decoder.decode()
              doneReading = true
            } else {
              buffer += decoder.decode(chunk.value, { stream: true })
            }
          }
        },
        async return(reason?: unknown): Promise<IteratorResult<T>> {
          if (!closed) {
            closed = true
            await cancelReader(reason)
          }
          return { done: true, value: undefined as T }
        },
      }
    },
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
  init: ResponseInit & NdjsonEncodeOptions = {}
): Response {
  const { signal, ...responseInit } = init
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/x-ndjson; charset=utf-8')
  }

  return new Response(encodeNdjson(source, { signal }), {
    ...responseInit,
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
