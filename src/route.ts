import { RoutePattern } from '@remix-run/route-pattern'
import { mapEntries } from './common.js'
import type {
  MutationMethod,
  QueryMethod,
  RouteArgs,
  RouteFunction,
  RouteRequest,
  RouteMethods,
  Unchecked,
} from './types.js'

export function $type<T>() {
  return null as unknown as Unchecked<T>
}

export function route<P extends string, T extends RouteMethods>(
  pattern: P,
  methods: T
) {
  const path = new RoutePattern(pattern)
  const createFetch =
    (method: string, route: QueryMethod | MutationMethod) =>
    (args: RouteArgs): RouteRequest => {
      return {
        route,
        path,
        method,
        args,
        $result: undefined!,
      }
    }

  return Object.assign(
    { path, methods },
    mapEntries(
      methods as Record<string, QueryMethod | MutationMethod>,
      (method, route) => [method, createFetch(method, route)]
    )
  ) as unknown as {
    path: RoutePattern<P>
    methods: T
  } & {
    [K in keyof T]: RouteFunction<Extract<T[K], QueryMethod | MutationMethod>>
  }
}
