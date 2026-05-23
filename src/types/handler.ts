import type { MatchParams } from '@remix-run/route-pattern/match'
import type { AnyMiddlewareChain, MiddlewareContext } from 'alien-middleware'
import type * as z from 'zod'
import { Promisable } from '../common.js'
import type { HttpAction } from '../http.js'
import type {
  InferRouteHandlerResult,
  InferResponseMapErrors,
  InferResponseMapSuccesses,
} from './response.js'
import type { RouteResponseMap, RouteSchema } from './schema.js'

type RequestContext<TMiddleware extends AnyMiddlewareChain> =
  MiddlewareContext<TMiddleware>

/**
 * Error response returned by `ctx.error(status, body)` in route handlers.
 *
 * @remarks This is an opaque branded type returned by the error helper. Route
 * handlers may return it to signal a declared error response.
 */
export type RouteErrorResponse = Response & { __routeError__: true }

/** Response returned by `ctx.success(status, body)` in route handlers. */
export type RouteSuccessResponse = Response & { __routeSuccess__: true }

export type RouteRequestHandler<
  TMiddleware extends AnyMiddlewareChain,
  TArgs extends object,
  TResult,
  TErrors = never,
  TSuccesses = never,
> = (
  context: RequestContext<TMiddleware> &
    TArgs &
    ([TErrors] extends [never]
      ? {}
      : {
          /**
           * Return a declared error response.
           *
           * @remarks Only statuses declared with `$error<T>()` in the response
           * map are accepted.
           */
          error: <TEntry extends TErrors>(
            ...args: TEntry extends [infer S extends number, infer B]
              ? [status: S, body: B]
              : never
          ) => RouteErrorResponse
        }) &
    ([TSuccesses] extends [never]
      ? {}
      : {
          /**
           * Return a declared success response with an explicit status.
           *
           * @remarks Useful when a response map declares multiple 2xx statuses.
           */
          success: <TEntry extends TSuccesses>(
            ...args: TEntry extends [infer S extends number, infer B]
              ? [status: S, body: B]
              : never
          ) => RouteSuccessResponse
        })
) => Promisable<TResult | Response>

export type InferActionHandler<
  TMiddleware extends AnyMiddlewareChain,
  TAction extends HttpAction,
  TPath extends string,
> = TAction['schema'] extends { response: infer R extends RouteResponseMap }
  ? TAction['method'] extends 'GET'
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
        InferRouteHandlerResult<Extract<TAction['schema'], RouteSchema>>,
        InferResponseMapErrors<R>,
        InferResponseMapSuccesses<R>
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
        InferRouteHandlerResult<Extract<TAction['schema'], RouteSchema>>,
        InferResponseMapErrors<R>,
        InferResponseMapSuccesses<R>
      >
  : TAction['method'] extends 'GET'
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
        InferRouteHandlerResult<Extract<TAction['schema'], RouteSchema>>
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
        InferRouteHandlerResult<Extract<TAction['schema'], RouteSchema>>
      >
