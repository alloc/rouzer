import { RoutePattern } from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'
import type { ZodObject } from 'zod'
import { Promisable, shake } from '../common.js'
import type { HttpAction, HttpResource, HttpRouteTree } from '../http.js'
import {
  getResponseMapPluginIds,
  isErrorMarker,
  isResponseMap,
} from '../response-map.js'
import {
  createResponsePluginMap,
  getResponsePluginMarkerId,
  type ClientResponsePlugin,
  type ResponsePluginMarker,
} from '../response.js'
import type { RouteInput, RouteOptions } from '../types/args.js'
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
   * Custom handler for non-2xx responses from generated client action
   * functions.
   *
   * @remarks When provided, the return value is returned from the client action
   * as-is; Rouzer does not automatically parse a `Response` returned by this
   * hook.
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

  async function plainRequest<T extends ClientRequest>({
    path: pathPattern,
    method,
    input = {},
    options: { headers, ...init } = {},
    schema,
  }: T) {
    const path = schema.path
      ? schema.path.parse(pickObjectSchemaFields(schema.path, input))
      : input

    let url: URL
    const href = createHref(pathPattern, path as Record<string, any>)
    if (href[0] === '/') {
      url = new URL(baseURL)
      url.pathname += href.slice(1)
    } else {
      url = new URL(href, baseURL)
    }

    if (schema.query) {
      const query = schema.query.parse(
        pickObjectSchemaFields(schema.query, input)
      )
      url.search = new URLSearchParams(
        shake(query) as Record<string, string>
      ).toString()
    }
    let body: unknown
    if (schema.body) {
      body = schema.body.parse(pickObjectSchemaFields(schema.body, input))
    }

    if (headers) {
      headers = shake(headers)
    }
    if (defaultHeaders) {
      headers = headers ? { ...defaultHeaders, ...headers } : defaultHeaders
    }
    if (schema.headers) {
      headers = schema.headers.parse(headers)
    }

    return fetch(url, {
      ...init,
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: (headers ?? defaultHeaders) as HeadersInit,
    }) as Promise<Response & { json(): Promise<T['$result']> }>
  }

  async function parsedRequest<T extends ClientRequest>(
    props: T
  ): Promise<T['$result']> {
    const response = await plainRequest(props)
    const responseSchema = props.schema.response

    // Handle status-keyed response maps
    if (isResponseMap(responseSchema)) {
      const status = response.status
      if (status in responseSchema) {
        const marker = responseSchema[status]
        if (isErrorMarker(marker)) {
          return [await response.json(), null, status] as T['$result']
        }
        const pluginId = getResponsePluginMarkerId(marker)
        if (pluginId) {
          const plugin = responsePlugins.get(pluginId)
          if (!plugin) {
            throw missingClientResponsePlugin(pluginId)
          }
          return [
            null,
            await plugin.decode(response, {
              marker: marker as ResponsePluginMarker<any, any>,
              request: props,
            }),
            status,
          ] as T['$result']
        }
        return [null, await response.json(), status] as T['$result']
      }
      // Undeclared status — reject
      return handleResponseError(response, props)
    }

    if (!response.ok) {
      return handleResponseError(response, props)
    }

    const pluginId = getResponsePluginMarkerId(responseSchema)
    if (pluginId) {
      const plugin = responsePlugins.get(pluginId)
      if (!plugin) {
        throw missingClientResponsePlugin(pluginId)
      }
      return plugin.decode(response, {
        marker: responseSchema as ResponsePluginMarker<any, any>,
        request: props,
      }) as T['$result']
    }

    return response.json()
  }

  async function handleResponseError<T extends ClientRequest>(
    response: Response,
    props: T
  ): Promise<T['$result']> {
    if (config.onJsonError) {
      return config.onJsonError(response) as T['$result']
    }
    const error = new Error(
      `Request to ${props.method} ${createHref(props.path, props.input as Record<string, any>)} failed with status ${response.status}`
    )
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      Object.assign(error, await response.json())
    }
    throw error
  }

  return {
    ...(connectTree(
      config.routes,
      '',
      plainRequest,
      parsedRequest
    ) as ClientTree<TRoutes>),
    clientConfig: config,
  }
}

/** Internal request descriptor passed from generated action functions. */
type ClientRequest<TResult = any> = {
  schema: RouteSchema
  path: RoutePattern
  method: string
  input?: unknown
  options?: RouteOptions
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
  ...p: RouteInput<T, P> extends infer TInput
    ? {} extends TInput
      ? [input?: TInput, options?: RouteOptions<T>]
      : [input: TInput, options?: RouteOptions<T>]
    : never
) => Promise<T extends { response: any } ? InferRouteResponse<T> : Response>

function connectTree(
  tree: HttpRouteTree,
  prefix: string,
  plainRequest: (props: ClientRequest) => Promise<Response>,
  parsedRequest: (props: ClientRequest) => Promise<any>
): any {
  return Object.fromEntries(
    Object.entries(tree).map(([key, node]) => {
      if (node.kind === 'resource') {
        return [
          key,
          connectTree(
            node.children,
            joinPaths(prefix, node.path.source),
            plainRequest,
            parsedRequest
          ),
        ]
      }
      const path = RoutePattern.parse(
        joinPaths(prefix, node.path?.source ?? '')
      )
      const fetch = node.schema.response ? parsedRequest : plainRequest
      return [
        key,
        (input?: unknown, options?: RouteOptions) =>
          fetch({
            schema: node.schema,
            path,
            method: node.method,
            input,
            options,
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

function pickObjectSchemaFields(schema: ZodObject, input: unknown) {
  if (typeof input !== 'object' || input === null) {
    return input
  }
  return Object.fromEntries(
    Object.keys(schema.shape)
      .filter(key => key in input)
      .map(key => [key, (input as Record<string, unknown>)[key]])
  )
}

function joinPaths(left: string, right: string) {
  return [left, right].filter(Boolean).join('/').replace(/\/+/g, '/')
}
