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
  return new ReadableStream(new NdjsonEncoder(source, options))
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
  return new NdjsonDecoder(stream)
}

class NdjsonEncoder implements UnderlyingDefaultSource<Uint8Array> {
  private readonly iterator: AsyncIterator<unknown>
  private readonly encoder = new TextEncoder()
  private cancelled = false
  private cleanup: Promise<void> | undefined
  private abortHandler: (() => void) | undefined

  constructor(
    source: NdjsonSource,
    private readonly options: NdjsonEncodeOptions
  ) {
    this.iterator = getAsyncIterator(source)
  }

  start(controller: ReadableStreamDefaultController<Uint8Array>) {
    const { signal } = this.options
    if (signal) {
      this.abortHandler = () => {
        void this.cancel(signal.reason).catch(() => {})
        try {
          controller.close()
        } catch {}
      }

      if (signal.aborted) {
        this.abortHandler()
      } else {
        signal.addEventListener('abort', this.abortHandler, { once: true })
      }
    }
  }

  async pull(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (this.cancelled) {
      controller.close()
      return
    }

    const { done, value } = await this.iterator.next()
    if (this.cancelled) {
      return
    }
    if (done) {
      this.removeAbortHandler()
      controller.close()
      return
    }

    const line = JSON.stringify(value)
    if (line === undefined) {
      throw new TypeError(
        'NDJSON items must serialize to a JSON text; received undefined'
      )
    }
    controller.enqueue(this.encoder.encode(`${line}\n`))
  }

  async cancel(reason?: unknown) {
    if (!this.cancelled) {
      this.cancelled = true
      this.removeAbortHandler()
      this.cleanup ??= Promise.resolve(this.iterator.return?.(reason)).then(
        () => {}
      )
    }
    await this.cleanup
  }

  private removeAbortHandler() {
    const { signal } = this.options
    if (signal && this.abortHandler) {
      signal.removeEventListener('abort', this.abortHandler)
      this.abortHandler = undefined
    }
  }
}

class NdjsonDecoder<T> implements AsyncIterable<T> {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  readonly decoder = new TextDecoder()
  buffer = ''
  lineNumber = 0
  closed = false
  doneReading = false
  readerReleased = false

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader()
  }

  [Symbol.asyncIterator]() {
    return new NdjsonAsyncIterator(this)
  }

  releaseReader() {
    if (!this.readerReleased) {
      this.readerReleased = true
      this.reader.releaseLock()
    }
  }

  async cancelReader(reason?: unknown) {
    if (!this.doneReading) {
      await this.reader.cancel(reason).catch(() => {})
    }
    this.releaseReader()
  }

  async parseNextLine(line: string): Promise<IteratorResult<T>> {
    try {
      this.lineNumber += 1
      return {
        done: false,
        value: parseNdjsonLine<T>(stripCarriageReturn(line), this.lineNumber),
      }
    } catch (error) {
      this.closed = true
      await this.cancelReader(error)
      throw error
    }
  }
}

class NdjsonAsyncIterator<T> implements AsyncIterator<T> {
  private closed = false

  constructor(private readonly decoder: NdjsonDecoder<T>) {}

  async next(): Promise<IteratorResult<T>> {
    if (this.closed || this.decoder.closed) {
      return { done: true, value: undefined as T }
    }

    while (true) {
      const newlineIndex = this.decoder.buffer.indexOf('\n')
      if (newlineIndex !== -1) {
        const line = this.decoder.buffer.slice(0, newlineIndex)
        this.decoder.buffer = this.decoder.buffer.slice(newlineIndex + 1)
        return this.decoder.parseNextLine(line)
      }

      if (this.decoder.doneReading) {
        this.close()
        this.decoder.releaseReader()
        if (this.decoder.buffer.length > 0) {
          const line = this.decoder.buffer
          this.decoder.buffer = ''
          return this.decoder.parseNextLine(line)
        }
        return { done: true, value: undefined as T }
      }

      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await this.decoder.reader.read()
      } catch (error) {
        this.close()
        this.decoder.releaseReader()
        throw error
      }
      if (this.closed || this.decoder.closed) {
        return { done: true, value: undefined as T }
      }
      if (chunk.done) {
        this.decoder.buffer += this.decoder.decoder.decode()
        this.decoder.doneReading = true
      } else {
        this.decoder.buffer += this.decoder.decoder.decode(chunk.value, {
          stream: true,
        })
      }
    }
  }

  async return(reason?: unknown): Promise<IteratorResult<T>> {
    if (!this.closed) {
      this.close()
      await this.decoder.cancelReader(reason)
    }
    return { done: true, value: undefined as T }
  }

  private close() {
    this.closed = true
    this.decoder.closed = true
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
  { signal, ...init }: ResponseInit & NdjsonEncodeOptions = {}
): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/x-ndjson; charset=utf-8')
  }

  return new Response(encodeNdjson(source, { signal }), {
    ...init,
    headers,
  })
}

function getAsyncIterator<T>(source: NdjsonSource<T>): AsyncIterator<T> {
  if (Symbol.asyncIterator in source) {
    return source[Symbol.asyncIterator]()
  }

  if (Symbol.iterator in source) {
    const iterator = source[Symbol.iterator]()
    return {
      next: async value => iterator.next(value),
      return: iterator.return
        ? async value => iterator.return!(value)
        : undefined,
      throw: iterator.throw ? async error => iterator.throw!(error) : undefined,
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
    ) as SyntaxError & { cause?: unknown }
    error.cause = cause
    throw error
  }
}
