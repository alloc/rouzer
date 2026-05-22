import { RoutePattern } from '@remix-run/route-pattern'
import { mapEntries, Unchecked } from './common.js'
import type {
  RouteArgs,
  RouteRequest,
  RouteRequestFactory,
  RouteSchema,
  RouteSchemaMap,
} from './types.js'

/**
 * Create a compile-time-only marker for a route's JSON response payload type.
 *
 * @remarks `$type<T>()` does not perform runtime validation. It lets Rouzer type
 * server handler return values and client action functions for routes whose
 * responses are expected to be JSON.
 *
 * @example
 * ```ts
 * import { $type } from 'rouzer'
 * import * as http from 'rouzer/http'
 *
 * const hello = http.get('hello/:name', {
 *   response: $type<{ message: string }>(),
 * })
 * ```
 */
export function $type<T>() {
  return $type.symbol as unknown as Unchecked<T>
}

$type.symbol = Symbol()

/**
 * Low-level route declaration produced by `route(...)`.
 *
 * @remarks A `Route` stores the parsed URL pattern, the method schema map, and a
 * request factory for each declared method. Use those factories with
 * `client.request(...)` or `client.json(...)` when you need explicit response
 * handling. For shared server/client route trees, prefer `rouzer/http` actions
 * and resources; `createRouter().use(...)` and `createClient({ routes })` expect
 * that HTTP route tree shape.
 */
export type Route<
  P extends string = string,
  T extends RouteSchemaMap = RouteSchemaMap,
> = {
  /** Parsed route pattern used for request URL generation. */
  path: RoutePattern<P>
  /** Method schemas declared for this route. */
  methods: T
} & {
  [K in keyof T]: RouteRequestFactory<Extract<T[K], RouteSchema>, P>
}

/**
 * Declare one URL pattern and its supported HTTP method schemas.
 *
 * @remarks This helper creates low-level request descriptor factories. Prefer
 * `rouzer/http` action helpers for routes that will be registered with
 * `createRouter().use(...)` or mirrored by `createClient({ routes })`.
 *
 * @param pattern Route pattern parsed by `@remix-run/route-pattern`.
 * @param methods Method schemas that describe request validation and optional
 * response typing.
 * @returns A route declaration with request factories such as `.GET(...)` and
 * `.POST(...)` for the declared methods.
 */
export function route<P extends string, T extends RouteSchemaMap>(
  pattern: P,
  methods: T
) {
  const path = RoutePattern.parse(pattern)
  const createFetch =
    (method: string, schema: RouteSchema) =>
    (args: RouteArgs = {}): RouteRequest => {
      return {
        schema,
        path,
        method,
        args,
        $result: undefined!,
      }
    }

  return Object.assign(
    { path, methods },
    mapEntries(methods as Record<string, RouteSchema>, (method, schema) => [
      method,
      createFetch(method, schema),
    ])
  ) as unknown as Route<P, T>
}
