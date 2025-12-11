import { Params, RoutePattern } from '@remix-run/route-pattern'
import * as z from 'zod/mini'

export type Promisable<T> = T | Promise<T>

export type Unchecked<T> = { __unchecked__: T }

export type QueryMethod = {
  path?: z.ZodMiniObject<any>
  query?: z.ZodMiniObject<any>
  body?: never
  headers?: z.ZodMiniObject<any>
  response: Unchecked<any>
}

export type MutationMethod = {
  path?: z.ZodMiniObject<any>
  query?: never
  body: z.ZodMiniType<any, any>
  headers?: z.ZodMiniObject<any>
  response?: Unchecked<any>
}

export type RouteMethods = {
  GET?: QueryMethod
  POST?: MutationMethod
  PUT?: MutationMethod
  PATCH?: MutationMethod
  DELETE?: MutationMethod
}

declare class Any {
  private isAny: true
}

type PathArgs<T> = T extends { path: infer TPath extends string }
  ? Params<TPath> extends infer TParams
    ? {} extends TParams
      ? { path?: TParams }
      : { path: TParams }
    : unknown
  : unknown

type QueryArgs<T> = T extends QueryMethod & { query: infer TQuery }
  ? {} extends z.infer<TQuery>
    ? { query?: z.infer<TQuery> }
    : { query: z.infer<TQuery> }
  : unknown

type MutationArgs<T> = T extends MutationMethod & { body: infer TBody }
  ? {} extends z.infer<TBody>
    ? { body?: z.infer<TBody> }
    : { body: z.infer<TBody> }
  : unknown

export type RouteArgs<T extends QueryMethod | MutationMethod = any> = ([
  T,
] extends [Any]
  ? { query?: any; body?: any; path?: any }
  : QueryArgs<T> & MutationArgs<T> & PathArgs<T>) &
  Omit<RequestInit, 'method' | 'body' | 'headers'> & {
    headers?: Record<string, string | undefined>
  }

export type RouteRequest<TResult = any> = {
  route: QueryMethod | MutationMethod
  pathPattern: RoutePattern
  method: string
  args: RouteArgs
  $result: TResult
}

export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

export type InferRouteResponse<T extends QueryMethod | MutationMethod> =
  T extends {
    response: Unchecked<infer TResponse>
  }
    ? TResponse
    : void

export type RouteFunction<T extends QueryMethod | MutationMethod> = {
  (args: RouteArgs<T>): RouteRequest<InferRouteResponse<T>>

  $args: RouteArgs<T>
  $response: InferRouteResponse<T>
}
