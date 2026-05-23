import type { RoutePattern } from '@remix-run/route-pattern'
import type { RouteArgs } from './args.js'
import type { InferRouteResponse } from './response.js'
import type { RouteSchema } from './schema.js'

/**
 * Request descriptor produced by an HTTP action request factory.
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

/**
 * Callable factory attached to an HTTP action.
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
  /** Inferred response type for this request factory. */
  $response: InferRouteResponse<T>
}
