import * as z from 'zod'
import { Unchecked } from '../common.js'

/**
 * Compile-time-only marker used by `$type<T>()` for unchecked response types.
 *
 * @remarks Application code should usually call `$type<T>()` instead of naming
 * this marker directly.
 */
export type { Unchecked }

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
  /** Optional compile-time-only JSON response type marker. */
  response?: Unchecked<any>
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
  /** Optional compile-time-only JSON response type marker. */
  response?: Unchecked<any>
}

/** Any HTTP action schema Rouzer can execute. */
export type RouteSchema = QueryRouteSchema | MutationRouteSchema
