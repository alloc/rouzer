import type { Unchecked, UncheckedError } from '../common.js'
import type { ResponsePluginMarker } from '../response.js'
import type { RouteResponseMap, RouteSchema } from './schema.js'

/** `Response` whose `.json()` method resolves to a known payload type. */
export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

/**
 * Helper: given a status-keyed response map, produce the discriminated tuple
 * union for the client.
 *
 * Each entry becomes:
 * - `$type<T>()` → `[null, T, Status]`
 * - `$error<T>()` → `[T, null, Status]`
 */
type InferResponseMapClient<T extends RouteResponseMap> = {
  [K in keyof T & number]: T[K] extends UncheckedError<infer TError>
    ? [TError, null, K]
    : T[K] extends Unchecked<infer TSuccess>
      ? [null, TSuccess, K]
      : T[K] extends ResponsePluginMarker<infer TClient, any>
        ? [null, TClient, K]
        : never
}[keyof T & number]

/** Infer the client response type from an action schema. */
export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: infer R
}
  ? R extends ResponsePluginMarker<infer TClient, any>
    ? TClient
    : R extends Unchecked<infer TResponse>
      ? TResponse
      : R extends RouteResponseMap
        ? InferResponseMapClient<R>
        : void
  : void

/**
 * Helper: given a status-keyed response map, produce the union of handler
 * result types (success values the handler can return directly).
 */
type InferResponseMapHandlerResult<T extends RouteResponseMap> = {
  [K in keyof T & number]: T[K] extends Unchecked<infer TSuccess>
    ? TSuccess
    : T[K] extends ResponsePluginMarker<any, infer TRouter>
      ? TRouter
      : never
}[keyof T & number]

/** Infer the non-`Response` handler result type from an action schema. */
export type InferRouteHandlerResult<T extends RouteSchema> = T extends {
  response: infer R
}
  ? R extends ResponsePluginMarker<any, infer TRouter>
    ? TRouter
    : R extends Unchecked<infer TResponse>
      ? TResponse
      : R extends RouteResponseMap
        ? InferResponseMapHandlerResult<R>
        : void
  : void

/**
 * Helper: given a status-keyed response map, extract error entries as a union
 * of `[status, body]` pairs for typing `ctx.error(status, body)`.
 */
export type InferResponseMapErrors<T extends RouteResponseMap> = {
  [K in keyof T & number]: T[K] extends UncheckedError<infer TError>
    ? [K, TError]
    : never
}[keyof T & number]

/** Extract success entries as a union of `[status, body]` pairs. */
export type InferResponseMapSuccesses<T extends RouteResponseMap> = {
  [K in keyof T & number]: T[K] extends Unchecked<infer TSuccess>
    ? [K, TSuccess]
    : T[K] extends ResponsePluginMarker<any, infer TRouter>
      ? [K, TRouter]
      : never
}[keyof T & number]
