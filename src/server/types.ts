import type { Params } from '@remix-run/route-pattern'
import type {
  AnyMiddlewareChain,
  MiddlewareChain,
  MiddlewareContext,
} from 'alien-middleware'
import type * as z from 'zod'
import { Promisable } from '../common.js'
import type { InferRouteResponse, Routes, RouteSchema } from '../types.js'

type RequestContext<TMiddleware extends AnyMiddlewareChain> =
  MiddlewareContext<TMiddleware>

type RouteRequestHandler<
  TMiddleware extends AnyMiddlewareChain,
  TArgs extends object,
  TResult,
> = (
  context: RequestContext<TMiddleware> & TArgs
) => Promisable<TResult | Response>

type InferRouteRequestHandler<
  TMiddleware extends AnyMiddlewareChain,
  TSchema extends RouteSchema,
  TMethod extends string,
  TPath extends string,
> = TMethod extends 'GET'
  ? RouteRequestHandler<
      TMiddleware,
      {
        path: TSchema extends { path: any }
          ? z.infer<TSchema['path']>
          : Params<TPath>
        query: TSchema extends { query: any }
          ? z.infer<TSchema['query']>
          : undefined
        headers: TSchema extends { headers: any }
          ? z.infer<TSchema['headers']>
          : undefined
      },
      InferRouteResponse<TSchema>
    >
  : RouteRequestHandler<
      TMiddleware,
      {
        path: TSchema extends { path: any }
          ? z.infer<TSchema['path']>
          : Params<TPath>
        body: TSchema extends { body: any }
          ? z.infer<TSchema['body']>
          : undefined
        headers: TSchema extends { headers: any }
          ? z.infer<TSchema['headers']>
          : undefined
      },
      InferRouteResponse<TSchema>
    >

/**
 * Handler map shape required by `createRouter().use(routes, handlers)`.
 *
 * @remarks Each route key must provide handlers for the methods declared by its
 * route schema. Handler context is inferred from middleware plus the route's
 * path, query/body, and header schemas. An optional `OPTIONS` handler can
 * customize CORS preflight responses for a route.
 */
export type RouteRequestHandlerMap<
  TRoutes extends Routes = Routes,
  TMiddleware extends AnyMiddlewareChain = MiddlewareChain,
> = {
  [K in keyof TRoutes]: {
    [TMethod in keyof TRoutes[K]['methods']]: InferRouteRequestHandler<
      TMiddleware,
      Extract<TRoutes[K]['methods'][TMethod], RouteSchema>,
      Extract<TMethod, string>,
      TRoutes[K]['path']['source']
    >
  } & {
    OPTIONS?: RouteRequestHandler<
      TMiddleware,
      {
        path: Params<TRoutes[K]['path']['source']>
      },
      void
    >
  }
}
