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
 * server handler return values and client shorthand methods for routes whose
 * responses are expected to be JSON.
 *
 * @example
 * ```ts
 * const helloRoute = route('hello/:name', {
 *   GET: {
 *     response: $type<{ message: string }>(),
 *   },
 * })
 * ```
 */
export function $type<T>() {
  return $type.symbol as unknown as Unchecked<T>
}

$type.symbol = Symbol()

/**
 * Shared route declaration produced by `route(...)`.
 *
 * @remarks A `Route` stores the parsed URL pattern, the method schema map, and a
 * request factory for each declared method. Pass route maps to both
 * `createRouter().use(...)` and `createClient({ routes })` to share the same
 * contract on both sides of an HTTP boundary.
 */
export type Route<
  P extends string = string,
  T extends RouteSchemaMap = RouteSchemaMap,
> = {
  /** Parsed route pattern used for URL generation and server-side matching. */
  path: RoutePattern<P>
  /** Method schemas declared for this route. */
  methods: T
} & {
  [K in keyof T]: RouteRequestFactory<Extract<T[K], RouteSchema>, P>
}

/**
 * Declare one URL pattern and its supported HTTP method schemas.
 *
 * @param pattern Route pattern parsed by `@remix-run/route-pattern`.
 * @param methods Method schemas that describe request validation and optional
 * response typing.
 * @returns A shared route declaration with request factories such as `.GET(...)`
 * and `.POST(...)` for the declared methods.
 */
export function route<P extends string, T extends RouteSchemaMap>(
  pattern: P,
  methods: T
) {
  const path = new RoutePattern(pattern)
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
