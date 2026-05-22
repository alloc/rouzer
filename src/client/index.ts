import { RoutePattern } from '@remix-run/route-pattern'
import { Promisable, shake } from '../common.js'
import type { HttpAction, HttpResource, HttpRouteTree } from '../http.js'
import type {
  InferRouteResponse,
  RouteArgs,
  RouteRequest,
  RouteSchema,
} from '../types.js'

/** Client type inferred from an HTTP route tree passed to `createClient`. */
export type RouzerClient<
  TRoutes extends HttpRouteTree = Record<string, never>,
> = ReturnType<typeof createClient<TRoutes>>

/**
 * Create a typed fetch client for an HTTP route tree.
 *
 * @remarks The returned client always includes `request(...)` for raw responses
 * and `json(...)` for parsed JSON. Passing `routes` also mirrors the resource
 * tree and attaches direct action functions such as `client.users.list(...)`.
 */
export function createClient<
  TRoutes extends HttpRouteTree = Record<string, never>,
>(config: {
  /**
   * Absolute base URL used for generated request URLs.
   *
   * @remarks A trailing slash is added when missing. In browsers, derive a
   * relative API path with `new URL('/api/', window.location.origin).href`.
   */
  baseURL: string
  /**
   * Default headers sent with every request.
   *
   * @remarks Per-request headers are merged on top of these values. Undefined
   * per-request headers are removed before `fetch`.
   */
  headers?: Record<string, string>
  /**
   * HTTP route tree to attach as direct client action functions.
   *
   * @example
   * ```ts
   * const client = createClient({ baseURL: 'https://example.com/api/', routes })
   * await client.users.list({ query: { page: 1 } })
   * ```
   */
  routes?: TRoutes
  /**
   * Custom handler for non-2xx responses from `.json()`.
   *
   * @remarks When provided, the return value is returned from `.json()` as-is;
   * Rouzer does not automatically parse a `Response` returned by this hook.
   */
  onJsonError?: (response: Response) => Promisable<Response>
  /** Custom `fetch` implementation to use for requests. */
  fetch?: typeof globalThis.fetch
}) {
  const baseURL = config.baseURL.replace(/\/?$/, '/')
  const defaultHeaders = config.headers && shake(config.headers)
  const fetch = config.fetch ?? globalThis.fetch

  async function request<T extends RouteRequest>({
    path: pathBuilder,
    method,
    args: { path, query, body, headers },
    schema,
  }: T) {
    if (schema.path) {
      path = schema.path.parse(path)
    }

    let url: URL
    const href = pathBuilder.href(path)
    if (href[0] === '/') {
      url = new URL(baseURL)
      url.pathname += href.slice(1)
    } else {
      url = new URL(href, baseURL)
    }

    if (schema.query) {
      query = schema.query.parse(query ?? {})
      url.search = new URLSearchParams(shake(query)).toString()
    } else if (query) {
      throw new Error('Unexpected query parameters')
    }
    if (schema.body) {
      body = schema.body.parse(body !== undefined ? body : {})
    } else if (body !== undefined) {
      throw new Error('Unexpected body')
    }

    if (headers) {
      headers = shake(headers)
    }
    if (defaultHeaders) {
      headers = headers ? { ...defaultHeaders, ...headers } : defaultHeaders
    }
    if (schema.headers) {
      headers = schema.headers.parse(headers) as any
    }

    return fetch(url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: (headers ?? defaultHeaders) as HeadersInit,
    }) as Promise<Response & { json(): Promise<T['$result']> }>
  }

  async function json<T extends RouteRequest>(props: T): Promise<T['$result']> {
    const response = await request(props)
    if (!response.ok) {
      if (config.onJsonError) {
        return config.onJsonError(response)
      }
      const error = new Error(
        `Request to ${props.method} ${props.path.href(props.args.path)} failed with status ${response.status}`
      )
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        Object.assign(error, await response.json())
      }
      throw error
    }
    return response.json()
  }

  return {
    ...((config.routes
      ? connectTree(config.routes, '', request, json)
      : null) as ClientTree<TRoutes>),
    config,
    request,
    json,
  }
}

type Join<A extends string, B extends string> = A extends ''
  ? B
  : B extends ''
    ? A
    : `${A}/${B}`

/** Client object shape produced from an HTTP route tree. */
export type ClientTree<T extends HttpRouteTree, TPrefix extends string = ''> = {
  [K in keyof T]: T[K] extends HttpResource<infer P, infer C>
    ? ClientTree<C, Join<TPrefix, P>>
    : T[K] extends HttpAction<infer P, infer S, any>
      ? RouteFunction<S, Join<TPrefix, P>>
      : never
}

/**
 * Client action function attached for each HTTP action leaf.
 *
 * @remarks Actions whose schema has `response: $type<T>()` return parsed JSON
 * as `T`. Actions without a response marker return the raw `Response`.
 */
export type RouteFunction<T extends RouteSchema, P extends string> = (
  ...p: RouteArgs<T, P> extends infer TArgs
    ? {} extends TArgs
      ? [args?: TArgs]
      : [args: TArgs]
    : never
) => Promise<T extends { response: any } ? InferRouteResponse<T> : Response>

function connectTree(
  tree: HttpRouteTree,
  prefix: string,
  request: (props: RouteRequest) => Promise<Response>,
  json: (props: RouteRequest) => Promise<any>
): any {
  return Object.fromEntries(
    Object.entries(tree).map(([key, node]) => {
      if (node.kind === 'resource') {
        return [
          key,
          connectTree(
            node.children,
            joinPaths(prefix, node.path.source),
            request,
            json
          ),
        ]
      }
      const path = new RoutePattern(joinPaths(prefix, node.path?.source ?? ''))
      const fetch = node.schema.response ? json : request
      return [
        key,
        (args: RouteArgs) =>
          fetch({
            schema: node.schema,
            path,
            method: node.method,
            args,
            $result: undefined!,
          }),
      ]
    })
  )
}

function joinPaths(left: string, right: string) {
  return [left, right].filter(Boolean).join('/').replace(/\/+/g, '/')
}
