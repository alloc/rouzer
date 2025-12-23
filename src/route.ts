import { RoutePattern } from '@remix-run/route-pattern'
import { mapEntries } from './common.js'
import type {
  RouteArgs,
  RouteRequest,
  RouteRequestFactory,
  RouteSchema,
  RouteSchemaMap,
  Unchecked,
} from './types.js'

export function $type<T>() {
  return null as unknown as Unchecked<T>
}

export type Route<
  P extends string = string,
  T extends RouteSchemaMap = RouteSchemaMap,
> = {
  path: RoutePattern<P>
  methods: T
} & {
  [K in keyof T]: RouteRequestFactory<Extract<T[K], RouteSchema>, P>
}

export function route<P extends string, T extends RouteSchemaMap>(
  pattern: P,
  methods: T
) {
  const path = new RoutePattern(pattern)
  const createFetch =
    (method: string, schema: RouteSchema) =>
    (args: RouteArgs): RouteRequest => {
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
