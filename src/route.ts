import { RoutePattern } from '@remix-run/route-pattern'
import { mapEntries } from './common'
import type {
  MutationRoute,
  QueryRoute,
  RouteArgs,
  RouteFunction,
  RouteRequest,
  Routes,
  Unchecked,
} from './types'

export function $type<T>() {
  return null as unknown as Unchecked<T>
}

export function route<P extends string, T extends Routes>(path: P, routes: T) {
  const pathPattern = new RoutePattern(path)
  const createFetch =
    (method: string, route: QueryRoute | MutationRoute) =>
    (args: RouteArgs): RouteRequest => {
      return {
        route,
        pathPattern,
        method,
        args,
        $result: undefined!,
      }
    }

  return Object.assign(
    { path, pathPattern, routes },
    mapEntries(
      routes as Record<string, QueryRoute | MutationRoute>,
      (method, route) => [method, createFetch(method, route)]
    )
  ) as unknown as {
    path: P
    pathPattern: RoutePattern
    routes: T
  } & {
    [K in keyof T]: RouteFunction<Extract<T[K], QueryRoute | MutationRoute>>
  }
}
