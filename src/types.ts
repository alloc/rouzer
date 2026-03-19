import { Params, RoutePattern } from '@remix-run/route-pattern'
import * as z from 'zod'
import { Unchecked } from './common.js'

export type { Unchecked }

export type QueryRouteSchema = {
  path?: z.ZodObject<any>
  query?: z.ZodObject<any>
  body?: never
  headers?: z.ZodObject<any>
  response?: Unchecked<any>
}

export type MutationRouteSchema = {
  path?: z.ZodObject<any>
  query?: never
  body?: z.ZodType<any, any>
  headers?: z.ZodObject<any>
  response?: Unchecked<any>
}

export type RouteSchemaMap = {
  GET?: QueryRouteSchema
  POST?: MutationRouteSchema
  PUT?: MutationRouteSchema
  PATCH?: MutationRouteSchema
  DELETE?: MutationRouteSchema
  ALL?: {
    path?: z.ZodObject<any>
    query?: z.ZodObject<any>
    body?: never
    headers?: z.ZodObject<any>
    response?: never
  }
}

export type RouteSchema = QueryRouteSchema | MutationRouteSchema

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
  : Params<P> extends infer TParams
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

type InferRouteSchemaBody<TSchema> = TSchema extends MutationRouteSchema
  ? TSchema extends { body: infer TBody }
    ? z.infer<TBody>
    : unknown
  : never

type InferRouteArgsBody<TArgs> = TArgs extends { body?: infer TBody }
  ? TBody
  : never

export type InferRouteBody<T> =
  T extends RouteRequestFactory<any, any>
    ? InferRouteArgsBody<T['$args']>
    : T extends RouteSchema
      ? InferRouteSchemaBody<T>
      : never

export type InferRouteMethodBody<
  TRoute extends { methods: RouteSchemaMap },
  TMethod extends keyof TRoute['methods'],
> = TMethod extends 'GET' | 'ALL'
  ? never
  : TMethod extends keyof TRoute
    ? InferRouteBody<TRoute[TMethod]>
    : InferRouteBody<Extract<TRoute['methods'][TMethod], RouteSchema>>

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
