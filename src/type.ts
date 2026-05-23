import {
  ndjsonResponseSymbol,
  type NdjsonResponse,
  type Unchecked,
} from './common.js'

/**
 * Create a compile-time-only marker for an action's JSON response payload type.
 *
 * @remarks `$type<T>()` does not perform runtime validation. It lets Rouzer type
 * server handler return values and client action functions for HTTP actions
 * whose responses are expected to be JSON.
 *
 * @example
 * ```ts
 * import { $type } from 'rouzer'
 * import * as http from 'rouzer/http'
 *
 * const hello = http.get('hello/:name', {
 *   response: $type<{ message: string }>(),
 * })
 * ```
 */
export function $type<T>() {
  return $type.symbol as unknown as Unchecked<T>
}

$type.symbol = Symbol()

/**
 * Create a compile-time marker for newline-delimited JSON response items.
 *
 * @remarks `$ndjson<T>()` tells Rouzer that the server handler returns an
 * `AsyncIterable<T>` and that generated client action functions should resolve
 * to an `AsyncIterable<T>`. Rouzer serializes and parses JSON lines, but it does
 * not validate streamed response items at runtime.
 *
 * @example
 * ```ts
 * import { $ndjson } from 'rouzer'
 * import * as http from 'rouzer/http'
 *
 * const events = http.get('events', {
 *   response: $ndjson<{ type: string }>(),
 * })
 * ```
 */
export function $ndjson<T>(): NdjsonResponse<T> {
  return { [ndjsonResponseSymbol]: undefined as T }
}
