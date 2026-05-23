import * as z from 'zod'
import type { NdjsonResponse, Unchecked } from '../common.js'

/**
 * Compile-time-only markers used by `$type<T>()` and `$ndjson<T>()` for response
 * types.
 *
 * @remarks Application code should usually call `$type<T>()` or `$ndjson<T>()`
 * instead of naming these markers directly.
 */
export type { NdjsonResponse, Unchecked }

/** Response marker accepted by HTTP action schemas. */
export type RouteResponseSchema = Unchecked<any> | NdjsonResponse<any>

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
  /** Optional compile-time-only JSON or NDJSON response type marker. */
  response?: RouteResponseSchema
}

/** Schema shape for mutation route methods. */
export type MutationRouteSchema = {
  /** Optional Zod object used to validate path params. */
  path?: z.ZodObject<any>
  /** Mutation routes do not accept query schemas. */
  query?: never
  /** Optional Zod schema used to validate the JSON request body. */
  body?: z.ZodType<any, any>
  /** Optional Zod object used to validate request headers. */
  headers?: z.ZodObject<any>
  /** Optional compile-time-only JSON or NDJSON response type marker. */
  response?: RouteResponseSchema
}

/** Any HTTP action schema Rouzer can execute. */
export type RouteSchema = QueryRouteSchema | MutationRouteSchema
