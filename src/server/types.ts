import type { Params } from '@remix-run/route-pattern'
import type {
  AnyMiddlewareChain,
  MiddlewareChain,
  MiddlewareContext,
} from 'alien-middleware'
import type * as z from 'zod/mini'
import type {
  InferRouteResponse,
  MutationRouteSchema,
  Promisable,
  QueryRouteSchema,
  Routes,
} from '../types.js'

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
  T,
  P extends string,
> = T extends QueryRouteSchema
  ? RouteRequestHandler<
      TMiddleware,
      {
        path: T extends { path: any } ? z.infer<T['path']> : Params<P>
        query: T extends { query: any } ? z.infer<T['query']> : undefined
        headers: T extends { headers: any } ? z.infer<T['headers']> : undefined
      },
      InferRouteResponse<T>
    >
  : T extends MutationRouteSchema
    ? RouteRequestHandler<
        TMiddleware,
        {
          path: T extends { path: any } ? z.infer<T['path']> : Params<P>
          body: T extends { body: any } ? z.infer<T['body']> : undefined
          headers: T extends { headers: any }
            ? z.infer<T['headers']>
            : undefined
        },
        InferRouteResponse<T>
      >
    : never

export type RouteRequestHandlerMap<
  TRoutes extends Routes = Routes,
  TMiddleware extends AnyMiddlewareChain = MiddlewareChain,
> = {
  [K in keyof TRoutes]: {
    [M in keyof TRoutes[K]['methods']]: InferRouteRequestHandler<
      TMiddleware,
      TRoutes[K]['methods'][M],
      TRoutes[K]['path']['source']
    >
  } & {
    OPTIONS?: RouteRequestHandler<TMiddleware, {}, void>
  }
}
