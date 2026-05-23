import type { Unchecked } from './common.js'

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
