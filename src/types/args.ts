import type { MatchParams } from '@remix-run/route-pattern/match'
import type * as z from 'zod'
import type {
  MutationRouteSchema,
  QueryRouteSchema,
  RouteSchema,
} from './schema.js'

declare class Any {
  private isAny: true
}

type PathArgs<T, P extends string> = T extends { path: infer TPath }
  ? {} extends z.infer<TPath>
    ? { [K in keyof T as 'path']?: z.infer<TPath> }
    : { [K in keyof T as 'path']: z.infer<TPath> }
  : MatchParams<P> extends infer TParams
    ? {} extends TParams
      ? { [K in keyof T as 'path']?: TParams }
      : { [K in keyof T as 'path']: TParams }
    : unknown

type QueryArgs<T> = T extends QueryRouteSchema & { query: infer TQuery }
  ? {} extends z.infer<TQuery>
    ? { [K in keyof T as 'query']?: z.infer<TQuery> }
    : { [K in keyof T as 'query']: z.infer<TQuery> }
  : unknown

type MutationArgs<T> = T extends MutationRouteSchema
  ? T extends { body: infer TBody }
    ? {} extends z.infer<TBody>
      ? { [K in keyof T as 'body']?: z.infer<TBody> }
      : { [K in keyof T as 'body']: z.infer<TBody> }
    : { body?: unknown }
  : unknown

/**
 * Arguments accepted by a generated client action function.
 *
 * @remarks The type is derived from an action schema and route pattern. `path`,
 * `query`, `body`, and `headers` are validated by the client before `fetch` when
 * a matching schema exists. Other `RequestInit` fields are forwarded to `fetch`,
 * except `method`, `body`, and `headers`, which Rouzer derives from the action
 * schema and call arguments.
 */
export type RouteArgs<
  T extends RouteSchema = any,
  P extends string = string,
> = ([T] extends [Any]
  ? { query?: any; body?: any; path?: any }
  : QueryArgs<T> & MutationArgs<T> & PathArgs<T, P>) &
  Omit<RequestInit, 'method' | 'body' | 'headers'> & {
    /** Headers for this request. Undefined values are removed before `fetch`. */
    headers?: Record<string, string | undefined>
  }
