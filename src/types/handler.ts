import type { MatchParams } from '@remix-run/route-pattern/match'
import type { AnyMiddlewareChain, MiddlewareContext } from 'alien-middleware'
import type * as z from 'zod'
import { Promisable } from '../common.js'
import type { HttpAction } from '../http.js'
import type { InferRouteResponse, RouteSchema } from '../types.js'

type RequestContext<TMiddleware extends AnyMiddlewareChain> =
  MiddlewareContext<TMiddleware>

export type RouteRequestHandler<
  TMiddleware extends AnyMiddlewareChain,
  TArgs extends object,
  TResult,
> = (
  context: RequestContext<TMiddleware> & TArgs
) => Promisable<TResult | Response>

export type InferActionHandler<
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
