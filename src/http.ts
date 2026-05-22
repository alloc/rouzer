import { RoutePattern } from '@remix-run/route-pattern'
import type { RouteArgs } from './types/args.js'
import type {
  RouteRequest,
  RouteRequestFactory,
} from './types/request.js'
import type { RouteSchema } from './types/schema.js'

/** HTTP methods supported by Rouzer action declarations. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Callable endpoint leaf in an HTTP route tree.
 *
 * @remarks Actions declare one HTTP operation. Their property name becomes the
 * client/handler name, while their optional `path` contributes URL segments.
 */
export type HttpAction<
  P extends string = string,
  T extends RouteSchema = RouteSchema,
  M extends HttpMethod = HttpMethod,
> = {
  /** Discriminator used internally when traversing route trees. */
  kind: 'action'
  /** Optional action-local path segment appended after parent resources. */
  path?: RoutePattern<P>
  /** HTTP method used when the client sends this action. */
  method: M
  /** Request validation and optional response type schema. */
  schema: T
  /** Low-level request descriptor factory for this action. */
  request: RouteRequestFactory<T, P>
}

/**
 * Path-scoped namespace in an HTTP route tree.
 *
 * @remarks Resources contribute URL path segments and contain child resources or
 * actions. They do not have handlers of their own.
 */
export type HttpResource<
  P extends string = string,
  TChildren extends HttpRouteTree = HttpRouteTree,
> = {
  /** Discriminator used internally when traversing route trees. */
  kind: 'resource'
  /** Path segment contributed by this resource. */
  path: RoutePattern<P>
  /** Child resources and actions exposed below this resource. */
  children: TChildren
}

/** Node type accepted inside an HTTP route tree. */
export type HttpNode = HttpAction | HttpResource

/** Route tree accepted by HTTP clients and routers. */
export type HttpRouteTree = { [key: string]: HttpNode }

/**
 * Declare an HTTP resource namespace.
 *
 * @remarks The resource `path` is joined with any parent resource path. Child
 * property names are API names only; they do not affect the URL unless the child
 * is another resource or an action with an explicit path.
 */
export function resource<
  const P extends string,
  const TChildren extends HttpRouteTree,
>(path: P, children: TChildren): HttpResource<P, TChildren> {
  return {
    kind: 'resource',
    path: RoutePattern.parse(path),
    children,
  }
}

/** Declare a GET action, optionally with an action-local path segment. */
export function get<const P extends string, const T extends RouteSchema>(
  path: P,
  schema: T
): HttpAction<P, T, 'GET'>
export function get<const T extends RouteSchema>(
  schema: T
): HttpAction<'', T, 'GET'>
export function get(
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
): any {
  return action('GET', pathOrSchema, schema)
}

/** Declare a POST action, optionally with an action-local path segment. */
export function post<const P extends string, const T extends RouteSchema>(
  path: P,
  schema: T
): HttpAction<P, T, 'POST'>
export function post<const T extends RouteSchema>(
  schema: T
): HttpAction<'', T, 'POST'>
export function post(
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
): any {
  return action('POST', pathOrSchema, schema)
}

/** Declare a PUT action, optionally with an action-local path segment. */
export function put<const P extends string, const T extends RouteSchema>(
  path: P,
  schema: T
): HttpAction<P, T, 'PUT'>
export function put<const T extends RouteSchema>(
  schema: T
): HttpAction<'', T, 'PUT'>
export function put(
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
): any {
  return action('PUT', pathOrSchema, schema)
}

/** Declare a PATCH action, optionally with an action-local path segment. */
export function patch<const P extends string, const T extends RouteSchema>(
  path: P,
  schema: T
): HttpAction<P, T, 'PATCH'>
export function patch<const T extends RouteSchema>(
  schema: T
): HttpAction<'', T, 'PATCH'>
export function patch(
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
): any {
  return action('PATCH', pathOrSchema, schema)
}

/** Declare a DELETE action, optionally with an action-local path segment. */
function deleteAction<const P extends string, const T extends RouteSchema>(
  path: P,
  schema: T
): HttpAction<P, T, 'DELETE'>
function deleteAction<const T extends RouteSchema>(
  schema: T
): HttpAction<'', T, 'DELETE'>
function deleteAction(
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
): any {
  return action('DELETE', pathOrSchema, schema)
}

export { deleteAction as delete }

function action(
  method: HttpMethod,
  pathOrSchema: string | RouteSchema,
  schema?: RouteSchema
) {
  const path =
    typeof pathOrSchema === 'string' ? RoutePattern.parse(pathOrSchema) : undefined
  schema ??= typeof pathOrSchema === 'string' ? {} : pathOrSchema
  const request = ((args: RouteArgs = {}): RouteRequest => ({
    schema,
    path: path ?? RoutePattern.parse(''),
    method,
    args,
    $result: undefined!,
  })) as RouteRequestFactory<RouteSchema, string>
  return { kind: 'action', path, method, schema, request }
}
