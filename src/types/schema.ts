import * as z from 'zod'
import type { Unchecked, UncheckedError } from '../common.js'
import type { ResponsePluginMarker } from '../response.js'

/**
 * Compile-time-only marker used by `$type<T>()` for unchecked JSON response
 * types.
 *
 * @remarks Application code should usually call `$type<T>()` instead of naming
 * this marker directly.
 */
export type { ResponsePluginMarker, Unchecked, UncheckedError }

/** Single response marker accepted by status-keyed response maps. */
export type RouteResponseMarker =
  | Unchecked<any>
  | UncheckedError<any>
  | z.ZodType
  | ResponsePluginMarker<any, any>

/**
 * Status-keyed response map for declaring multiple response types.
 *
 * @remarks Numeric keys are HTTP status codes. Use `$type<T>()` or a response
 * plugin marker for success responses and `$error<T>()` for declared error
 * JSON responses.
 */
export type RouteResponseMap = {
  [status: number]: RouteResponseMarker
}

/** Response marker accepted by HTTP action schemas. */
export type RouteResponseSchema =
  | Unchecked<any>
  | z.ZodType
  | ResponsePluginMarker<any, any>
  | RouteResponseMap

/** Schema shape for `GET` route methods. */
export type QueryRouteSchema = {
  /** Optional Zod object used to validate path params. */
  path?: z.ZodObject<any>
  /** Optional Zod object used to validate URL query params. */
  query?: z.ZodObject<any>
  /** `GET` routes do not accept request bodies. */
  body?: never
  /** Optional Zod object used to validate request headers. */
  headers?: z.ZodObject<any>
  /** Optional Zod schema, compile-time JSON marker, plugin marker, or status map. */
  response?: RouteResponseSchema
}

/** Marker for request bodies passed through to `fetch` without JSON encoding. */
export type RawBodySchema = {
  readonly __rawBody__: unique symbol
}

/** Schema shape for mutation route methods. */
export type MutationRouteSchema = {
  /** Optional Zod object used to validate path params. */
  path?: z.ZodObject<any>
  /** Mutation routes do not accept query schemas. */
  query?: never
  /** Optional Zod schema used to validate the JSON request body, or raw body marker. */
  body?: z.ZodObject<any> | RawBodySchema
  /** Optional Zod object used to validate request headers. */
  headers?: z.ZodObject<any>
  /** Optional Zod schema, compile-time JSON marker, plugin marker, or status map. */
  response?: RouteResponseSchema
}

/** Any HTTP action schema Rouzer can execute. */
export type RouteSchema = QueryRouteSchema | MutationRouteSchema
