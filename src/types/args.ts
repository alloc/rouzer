import type { MatchParams } from '@remix-run/route-pattern/match'
import type * as z from 'zod'
import type {
  MutationRouteSchema,
  QueryRouteSchema,
  RawBodySchema,
  RouteSchema,
} from './schema.js'

declare class Any {
  private isAny: true
}

type PathInput<T, P extends string> = T extends { path: infer TPath }
  ? z.infer<TPath>
  : MatchParams<P>

type QueryInput<T> = T extends QueryRouteSchema & { query: infer TQuery }
  ? z.infer<TQuery>
  : unknown

type BodyInput<T> = T extends MutationRouteSchema
  ? T extends { body: infer TBody }
    ? TBody extends RawBodySchema
      ? unknown
      : z.infer<TBody>
    : unknown
  : unknown

type HeaderInput<T> = T extends { headers: infer THeaders }
  ? Partial<z.infer<THeaders>>
  : Record<string, string | undefined>

/**
 * Semantic input accepted by a generated client action function.
 *
 * @remarks Path params, query params, and JSON body fields are flattened into a
 * single object. Avoid declaring duplicate keys across path/query/body schemas,
 * since a flat input cannot distinguish their source.
 */
export type RouteInput<
  T extends RouteSchema = any,
  P extends string = string,
> = [T] extends [Any] ? any : PathInput<T, P> & QueryInput<T> & BodyInput<T>

/**
 * Fetch options accepted as the second argument to a generated client action.
 *
 * @remarks `headers` remains optional because required route headers may be
 * supplied by `createClient({ headers })` defaults.
 */
type RouteBodyOption<T> = T extends { body: RawBodySchema }
  ? { body: BodyInit | null }
  : {}

export type RouteOptions<T extends RouteSchema = any> = Omit<
  RequestInit,
  'method' | 'body' | 'headers'
> &
  RouteBodyOption<T> & {
    /** Headers for this request. Undefined values are removed before `fetch`. */
    headers?: HeaderInput<T>
  }
