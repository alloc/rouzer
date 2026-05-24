import { RoutePattern } from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'
import { Promisable, shake } from '../common.js'
import type { HttpAction, HttpResource, HttpRouteTree } from '../http.js'
import {
  createResponsePluginMap,
  getResponsePluginMarkerId,
  type ClientResponsePlugin,
  type ResponsePluginMarker,
} from '../response.js'
import {
  getResponseMapPluginIds,
  isErrorMarker,
  isResponseMap,
} from '../response-map.js'
import type { RouteArgs } from '../types/args.js'
import type { InferRouteResponse } from '../types/response.js'
import type { RouteSchema } from '../types/schema.js'

/** Client type inferred from an HTTP route tree passed to `createClient`. */
export type RouzerClient<
  TRoutes extends HttpRouteTree = Record<string, never>,
> = ReturnType<typeof createClient<TRoutes>>

/**
 * Create a typed fetch client for an HTTP route tree.
 *
 * @remarks The returned client mirrors the resource tree and attaches direct
 * action functions such as `client.users.list(...)`.
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
  routes: TRoutes
  /** Response codec plugins used by generated action functions. */
  plugins?: readonly ClientResponsePlugin[]
  /**
   * Custom handler for non-2xx responses from `.json()` and generated response
   * helpers.
   *
   * @remarks When provided, the return value is returned from the response
   * helper as-is; Rouzer does not automatically parse a `Response` returned by
   * this hook.
   */
  onJsonError?: (response: Response) => Promisable<unknown>
  /** Custom `fetch` implementation to use for requests. */
  fetch?: typeof globalThis.fetch
}) {
  const baseURL = config.baseURL.replace(/\/?$/, '/')
  const defaultHeaders = config.headers && shake(config.headers)
  const fetch = config.fetch ?? globalThis.fetch
  const responsePlugins = createResponsePluginMap(
    config.plugins,
    'client response'
  )

  validateClientResponsePlugins(config.routes, responsePlugins)

  async function request<T extends ClientRequest>({
    path: pathBuilder,
    method,
    args,
    schema,
  }: T) {
    let { path, query, body, headers, ...init } = args
    if (schema.path) {
      path = schema.path.parse(path)
    }

    let url: URL
    const href = createHref(pathBuilder, path)
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
      ...init,
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: (headers ?? defaultHeaders) as HeadersInit,
    }) as Promise<Response & { json(): Promise<T['$result']> }>
  }

  async function response<T extends ClientRequest>(
    props: T
  ): Promise<T['$result']> {
    const httpResponse = await request(props)
    const responseSchema = props.schema.response

    // Handle status-keyed response maps
    if (isResponseMap(responseSchema)) {
      const status = httpResponse.status
      if (status in responseSchema) {
        const marker = responseSchema[status]
        if (isErrorMarker(marker)) {
          return [await httpResponse.json(), null, status] as T['$result']
        }
        const pluginId = getResponsePluginMarkerId(marker)
        if (pluginId) {
          const plugin = responsePlugins.get(pluginId)
          if (!plugin) {
            throw missingClientResponsePlugin(pluginId)
          }
          return [
            null,
            await plugin.decode(httpResponse, {
              marker: marker as ResponsePluginMarker<any, any>,
              request: props,
            }),
            status,
          ] as T['$result']
        }
        return [null, await httpResponse.json(), status] as T['$result']
      }
      // Undeclared status — reject
      return handleResponseError(httpResponse, props)
    }

    if (!httpResponse.ok) {
      return handleResponseError(httpResponse, props)
    }

    const pluginId = getResponsePluginMarkerId(responseSchema)
    if (pluginId) {
      const plugin = responsePlugins.get(pluginId)
      if (!plugin) {
        throw missingClientResponsePlugin(pluginId)
      }
      return plugin.decode(httpResponse, {
        marker: responseSchema as unknown as ResponsePluginMarker<any, any>,
        request: props,
      }) as T['$result']
    }

    return httpResponse.json()
  }

  async function handleResponseError<T extends ClientRequest>(
    response: Response,
    props: T
  ): Promise<T['$result']> {
    if (config.onJsonError) {
      return config.onJsonError(response) as T['$result']
    }
    const error = new Error(
      `Request to ${props.method} ${createHref(props.path, props.args.path)} failed with status ${response.status}`
    )
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      Object.assign(error, await response.json())
    }
    throw error
  }

  return {
    ...(connectTree(config.routes, '', request, response) as ClientTree<TRoutes>),
    clientConfig: config,
  }
}

/** Internal request descriptor passed from generated action functions. */
type ClientRequest<TResult = any> = {
  schema: RouteSchema
  path: RoutePattern
  method: string
  args: RouteArgs
  $result: TResult
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
 * as `T`. Actions whose schema has a status-keyed response map return a tuple
 * union of `[null, value, status]` success entries and `[error, null, status]`
 * error entries. Actions whose schema has a plugin response marker return the
 * plugin's client result type. Actions without a response marker return the raw
 * `Response`.
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
  request: (props: ClientRequest) => Promise<Response>,
  response: (props: ClientRequest) => Promise<any>
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
            response
          ),
        ]
      }
      const path = RoutePattern.parse(
        joinPaths(prefix, node.path?.source ?? '')
      )
      const fetch = node.schema.response ? response : request
      return [
        key,
        (args: RouteArgs = {}) =>
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

function validateClientResponsePlugins(
  tree: HttpRouteTree,
  plugins: Map<string, ClientResponsePlugin>
) {
  for (const node of Object.values(tree)) {
    if (node.kind === 'resource') {
      validateClientResponsePlugins(node.children, plugins)
    } else {
      const pluginIds = isResponseMap(node.schema.response)
        ? getResponseMapPluginIds(node.schema.response)
        : [getResponsePluginMarkerId(node.schema.response)].filter(
            pluginId => pluginId !== undefined
          )
      for (const pluginId of pluginIds) {
        if (!plugins.has(pluginId)) {
          throw missingClientResponsePlugin(pluginId)
        }
      }
    }
  }
}

function missingClientResponsePlugin(pluginId: string) {
  return new Error(`Missing client response plugin for ${pluginId}`)
}

function joinPaths(left: string, right: string) {
  return [left, right].filter(Boolean).join('/').replace(/\/+/g, '/')
}
