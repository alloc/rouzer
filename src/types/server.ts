import type { AnyMiddlewareChain } from 'alien-middleware'
import type { HttpAction, HttpResource, HttpRouteTree } from '../http.js'
import type { InferActionHandler } from './handler.js'
import type { Join } from './path.js'

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
  TMiddleware extends AnyMiddlewareChain = never,
  TPrefix extends string = '',
> = {
  [K in keyof TRoutes]: TRoutes[K] extends HttpResource<infer P, infer C>
    ? RouteRequestHandlerMap<C, TMiddleware, Join<TPrefix, P>>
    : TRoutes[K] extends HttpAction<infer P, any, any>
      ? InferActionHandler<TMiddleware, TRoutes[K], Join<TPrefix, P>>
      : never
}
