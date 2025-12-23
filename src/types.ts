import { Params, RoutePattern } from '@remix-run/route-pattern'
import * as z from 'zod/mini'

export type Promisable<T> = T | Promise<T>

export type Unchecked<T> = { __unchecked__: T }

export type QueryRouteSchema = {
  path?: z.ZodMiniObject<any>
  query?: z.ZodMiniObject<any>
  body?: never
  headers?: z.ZodMiniObject<any>
  response?: Unchecked<any>
}

export type MutationRouteSchema = {
  path?: z.ZodMiniObject<any>
  query?: never
  body?: z.ZodMiniType<any, any>
  headers?: z.ZodMiniObject<any>
  response?: Unchecked<any>
}

export type RouteSchemaMap = {
  GET?: QueryRouteSchema
  POST?: MutationRouteSchema
  PUT?: MutationRouteSchema
  PATCH?: MutationRouteSchema
  DELETE?: MutationRouteSchema
}

export type Method = string & keyof RouteSchemaMap
export type RouteSchema = QueryRouteSchema | MutationRouteSchema

export type Routes = {
  [key: string]: { path: RoutePattern; methods: RouteSchemaMap }
}

declare class Any {
  private isAny: true
}

type PathArgs<T, P extends string> = T extends { path: infer TPath }
  ? {} extends z.infer<TPath>
    ? { path?: z.infer<TPath> }
    : { path: z.infer<TPath> }
  : Params<P> extends infer TParams
    ? {} extends TParams
      ? { path?: TParams }
      : { path: TParams }
    : unknown

type QueryArgs<T> = T extends QueryRouteSchema & { query: infer TQuery }
  ? {} extends z.infer<TQuery>
    ? { query?: z.infer<TQuery> }
    : { query: z.infer<TQuery> }
  : unknown

type MutationArgs<T> = T extends MutationRouteSchema
  ? T extends { body: infer TBody }
    ? {} extends z.infer<TBody>
      ? { body?: z.infer<TBody> }
      : { body: z.infer<TBody> }
    : { body?: unknown }
  : unknown

export type RouteArgs<
  T extends RouteSchema = any,
  P extends string = string,
> = ([T] extends [Any]
  ? { query?: any; body?: any; path?: any }
  : QueryArgs<T> & MutationArgs<T> & PathArgs<T, P>) &
  Omit<RequestInit, 'method' | 'body' | 'headers'> & {
    headers?: Record<string, string | undefined>
  }

export type RouteRequest<TResult = any> = {
  schema: RouteSchema
  path: RoutePattern
  method: string
  args: RouteArgs
  $result: TResult
}

export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: Unchecked<infer TResponse>
}
  ? TResponse
  : void

export type RouteRequestFactory<T extends RouteSchema, P extends string> = {
  (
    ...p: RouteArgs<T, P> extends infer TArgs
      ? {} extends TArgs
        ? [args?: TArgs]
        : [args: TArgs]
      : never
  ): RouteRequest<InferRouteResponse<T>>

  $args: RouteArgs<T, P>
  $response: InferRouteResponse<T>
}
