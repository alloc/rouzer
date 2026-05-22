import { RoutePattern } from '@remix-run/route-pattern'
import type { MatchParams } from '@remix-run/route-pattern/match'
import * as z from 'zod'
import { Unchecked } from './common.js'

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

/**
 * Method schema map accepted by `route(...)`.
 *
 * @remarks `GET` validates query input, mutation methods validate JSON body
 * input, and `ALL` acts as a fallback for methods that are not declared
 * explicitly.
 */
export type RouteSchemaMap = {
  GET?: QueryRouteSchema
  POST?: MutationRouteSchema
  PUT?: MutationRouteSchema
  PATCH?: MutationRouteSchema
  DELETE?: MutationRouteSchema
  ALL?: {
    /** Optional Zod object used to validate path params. */
    path?: z.ZodObject<any>
    /** Optional Zod object used to validate URL query params. */
    query?: z.ZodObject<any>
    /** `ALL` fallback routes do not accept request bodies. */
    body?: never
    /** Optional Zod object used to validate request headers. */
    headers?: z.ZodObject<any>
    /** `ALL` fallback routes do not define typed JSON responses. */
    response?: never
  }
}

/** Any route method schema Rouzer can execute. */
export type RouteSchema = QueryRouteSchema | MutationRouteSchema

/** Route map accepted by `createRouter().use(...)` and `createClient(...)`. */
export type Routes = {
  [key: string]: { path: RoutePattern; methods: RouteSchemaMap }
}

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
 * Arguments accepted by a route request factory such as `route.GET(...)`.
 *
 * @remarks The type is derived from a method schema and route pattern. `path`,
 * `query`, `body`, and `headers` are validated by the client before `fetch` when
 * a matching schema exists. The client forwards the HTTP method, JSON body, and
 * headers; extra `RequestInit` fields are accepted by the type surface but are
 * not forwarded.
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

/**
 * Request descriptor produced by a route request factory.
 *
 * @remarks Pass this object to `client.request(...)` for a raw `Response` or
 * `client.json(...)` for parsed JSON handling.
 */
export type RouteRequest<TResult = any> = {
  /** Method schema used for client-side validation. */
  schema: RouteSchema
  /** Parsed route pattern used to generate the request URL. */
  path: RoutePattern
  /** HTTP method to send. */
  method: string
  /** Validated route arguments and request options. */
  args: RouteArgs
  /** Phantom result type consumed by `client.json(...)`. */
  $result: TResult
}

/** `Response` whose `.json()` method resolves to a known payload type. */
export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

/** Infer the JSON response payload type from a method schema. */
export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: Unchecked<infer TResponse>
}
  ? TResponse
  : void

type InferRouteSchemaBody<TSchema> = TSchema extends MutationRouteSchema
  ? TSchema extends { body: infer TBody }
    ? z.infer<TBody>
    : unknown
  : never

type InferRouteArgsBody<TArgs> = TArgs extends { body?: infer TBody }
  ? TBody
  : never

/**
 * Infer the request body type from a mutation schema or route request factory.
 *
 * @remarks Route request factories for mutation methods infer their `body`
 * argument type. Mutation schemas without a body schema infer `unknown`.
 */
export type InferRouteBody<T> =
  T extends RouteRequestFactory<any, any>
    ? InferRouteArgsBody<T['$args']>
    : T extends RouteSchema
      ? InferRouteSchemaBody<T>
      : never

/**
 * Infer the request body type for a named method on a `Route`.
 *
 * @remarks `GET` and `ALL` infer `never` because they do not accept request
 * bodies.
 */
export type InferRouteMethodBody<
  TRoute extends { methods: RouteSchemaMap },
  TMethod extends keyof TRoute['methods'],
> = TMethod extends 'GET' | 'ALL'
  ? never
  : TMethod extends keyof TRoute
    ? InferRouteBody<TRoute[TMethod]>
    : InferRouteBody<Extract<TRoute['methods'][TMethod], RouteSchema>>

/**
 * Callable factory attached to a `Route` for each declared method.
 *
 * @remarks Calling a factory validates no data by itself; it creates a typed
 * `RouteRequest` descriptor for `createClient` to validate and send.
 */
export type RouteRequestFactory<T extends RouteSchema, P extends string> = {
  (
    ...p: RouteArgs<T, P> extends infer TArgs
      ? {} extends TArgs
        ? [args?: TArgs]
        : [args: TArgs]
      : never
  ): RouteRequest<InferRouteResponse<T>>

  /** Inferred argument type for this request factory. */
  $args: RouteArgs<T, P>
  /** Inferred JSON response type for this request factory. */
  $response: InferRouteResponse<T>
}
