import type { MatchParams } from '@remix-run/route-pattern/match'
import type {
  AnyMiddlewareChain,
  MiddlewareChain,
  MiddlewareContext,
} from 'alien-middleware'
import type * as z from 'zod'
import { Promisable } from '../common.js'
import type { HttpAction, HttpResource, HttpRouteTree } from '../http.js'
import type { InferRouteResponse, RouteSchema } from '../types.js'

type RequestContext<TMiddleware extends AnyMiddlewareChain> =
  MiddlewareContext<TMiddleware>

type RouteRequestHandler<
  TMiddleware extends AnyMiddlewareChain,
  TArgs extends object,
  TResult,
> = (
  context: RequestContext<TMiddleware> & TArgs
) => Promisable<TResult | Response>

type InferActionHandler<
  TMiddleware extends AnyMiddlewareChain,
  TAction extends HttpAction,
  TPath extends string,
> = TAction['method'] extends 'GET'
  ? RouteRequestHandler<
      TMiddleware,
      {
        path: TAction['schema'] extends { path: any }
          ? z.infer<TAction['schema']['path']>
          : MatchParams<TPath>
        query: TAction['schema'] extends { query: any }
          ? z.infer<TAction['schema']['query']>
          : undefined
        headers: TAction['schema'] extends { headers: any }
          ? z.infer<TAction['schema']['headers']>
          : undefined
      },
      InferRouteResponse<Extract<TAction['schema'], RouteSchema>>
    >
  : RouteRequestHandler<
      TMiddleware,
      {
        path: TAction['schema'] extends { path: any }
          ? z.infer<TAction['schema']['path']>
          : MatchParams<TPath>
        body: TAction['schema'] extends { body: any }
          ? z.infer<TAction['schema']['body']>
          : undefined
        headers: TAction['schema'] extends { headers: any }
          ? z.infer<TAction['schema']['headers']>
          : undefined
      },
      InferRouteResponse<Extract<TAction['schema'], RouteSchema>>
    >

type Join<A extends string, B extends string> = A extends ''
  ? B
  : B extends ''
    ? A
    : `${A}/${B}`

/**
 * Handler map shape required by `createRouter().use(routes, handlers)`.
 *
 * @remarks The handler object mirrors the HTTP route tree. Resource nodes become
 * nested handler objects, while action nodes become direct handler functions.
 * Handler context is inferred from middleware plus accumulated path params,
 * query/body schemas, and header schemas.
 */
export type RouteRequestHandlerMap<
  TRoutes extends HttpRouteTree = HttpRouteTree,
  TMiddleware extends AnyMiddlewareChain = MiddlewareChain,
  TPrefix extends string = '',
> = {
  [K in keyof TRoutes]: TRoutes[K] extends HttpResource<infer P, infer C>
    ? RouteRequestHandlerMap<C, TMiddleware, Join<TPrefix, P>>
    : TRoutes[K] extends HttpAction<infer P, any, any>
      ? InferActionHandler<TMiddleware, TRoutes[K], Join<TPrefix, P>>
      : never
}
