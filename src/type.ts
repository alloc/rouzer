import type { Unchecked, UncheckedError } from './common.js'

/**
 * Create a compile-time-only marker for an action's JSON response payload type.
 *
 * @remarks `$type<T>()` does not perform runtime validation. It lets Rouzer type
 * server handler return values and client action functions for HTTP actions
 * whose responses are expected to be JSON. Use it directly as `response` for one
 * JSON success shape, or as a success entry in a status-keyed response map.
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
 * Create a compile-time-only marker for a declared error response type.
 *
 * @remarks `$error<T>()` marks a non-success response branch in a status-keyed
 * response map. On the server, handlers use `ctx.error(status, body)` to return
 * declared errors. On the client, declared error responses resolve as
 * `[error, null, status]` tuple entries instead of rejecting the promise.
 *
 * @example
 * ```ts
 * import { $type, $error } from 'rouzer'
 * import * as http from 'rouzer/http'
 *
 * const getUser = http.get('users/:id', {
 *   response: {
 *     200: $type<User>(),
 *     404: $error<{ code: string; message: string }>(),
 *   },
 * })
 * ```
 */
export function $error<T>() {
  return $error.symbol as unknown as UncheckedError<T>
}

$error.symbol = Symbol()
