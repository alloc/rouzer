import { RoutePattern } from '@remix-run/route-pattern'
import { createHref } from '@remix-run/route-pattern/href'
import * as z from 'zod'
import { Promisable, shake } from '../common.js'
import {
  isRawBodySchema,
  type HttpAction,
  type HttpResource,
  type HttpRouteTree,
} from '../http.js'
import {
  getResponseMapPluginIds,
  isErrorResponse,
  isResponseMap,
  isZodResponseSchema,
} from '../response-map.js'
import {
  createResponsePluginMap,
  getResponsePluginMarkerId,
  type ClientResponsePlugin,
  type ResponsePluginMarker,
} from '../response.js'
import type {
  RouteFetchOptions,
  RouteInput,
  RouteOptions,
} from '../types/args.js'
import type { RawBodySchema } from '../types/schema.js'
import type { InferRouteResponse } from '../types/response.js'
import type { RouteSchema } from '../types/schema.js'

/** Lifecycle event emitted by generated client action functions. */
export type RouzerClientHookEvent =
  | {
      type: 'request.start'
      opId: string
      routeName: string
      method: string
      pathPattern: string
      payload: unknown
    }
  | {
      type: 'request.success'
      opId: string
      routeName: string
      method: string
      pathPattern: string
      payload: unknown
      response: unknown
      status?: number
      durationMs: number
    }
  | {
      type: 'request.error'
      opId: string
      routeName: string
      method: string
      pathPattern: string
      payload: unknown
      error: unknown
      status?: number
      durationMs: number
    }

/** Best-effort observer for generated client action lifecycles. */
export type RouzerClientHook = (event: RouzerClientHookEvent) => void

let nextClientOpId = 0

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
   * await client.users.list({ page: 1 })
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
  /**
   * Best-effort lifecycle observer for generated client action calls.
   *
   * @remarks Hook errors are swallowed and never change request behavior.
   */
  clientHook?: RouzerClientHook
}) {
  const baseURL = config.baseURL.replace(/\/?$/, '/')
  const defaultHeaders = config.headers && shake(config.headers)
  const fetch = config.fetch ?? globalThis.fetch
  const responsePlugins = createResponsePluginMap(
    config.plugins,
    'client response'
  )

  validateClientResponsePlugins(config.routes, responsePlugins)

  async function plainRequest<T extends ClientRequest>(props: T) {
    const { path: pathPattern, method, input = {}, schema } = props
    const { body: rawBody, ...options } = props.options ?? {}
    let { headers, ...init } = options
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
      body = isRawBodySchema(schema.body)
        ? rawBody
        : schema.body.parse(pickObjectSchemaFields(schema.body, input))
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

    return (await fetch(url, {
      ...init,
      method,
      body: isRawBodySchema(schema.body)
        ? (body as BodyInit | null | undefined)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
      headers: (headers ?? defaultHeaders) as HeadersInit,
    })) as Response & { json(): Promise<T['$result']> }
  }

  async function parseResponse<T extends ClientRequest>(
    response: Response & { json(): Promise<T['$result']> },
    props: T
  ): Promise<T['$result']> {
    const responseSchema = props.schema.response

    // Handle status-keyed response maps
    if (isResponseMap(responseSchema)) {
      const status = response.status
      if (status in responseSchema) {
        const marker = responseSchema[status]
        if (isErrorResponse(status, marker)) {
          const value = await response.json()
          return [
            isZodResponseSchema(marker)
              ? await marker.parseAsync(value)
              : value,
            null,
            status,
          ] as T['$result']
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
        const value = await response.json()
        return [
          null,
          isZodResponseSchema(marker) ? await marker.parseAsync(value) : value,
          status,
        ] as T['$result']
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

    const value = await response.json()
    return isZodResponseSchema(responseSchema)
      ? responseSchema.parseAsync(value)
      : value
  }

  async function plainClientRequest<T extends ClientRequest>(
    props: T
  ): Promise<ClientRequestResult<T['$result']>> {
    const response = await plainRequest(props)
    return {
      value: response as T['$result'],
      status: response.status,
    }
  }

  async function parsedClientRequest<T extends ClientRequest>(
    props: T
  ): Promise<ClientRequestResult<T['$result']>> {
    const response = await plainRequest(props)
    try {
      return {
        value: await parseResponse(response, props),
        status: response.status,
      }
    } catch (error) {
      throw new ClientRequestFailure(error, response.status)
    }
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
      '',
      plainClientRequest,
      parsedClientRequest,
      config.clientHook
    ) as ClientTree<TRoutes>),
    clientConfig: config,
  }
}

/** Internal request descriptor passed from generated action functions. */
type ClientRequest<TResult = any> = {
  schema: RouteSchema
  path: RoutePattern
  routeName: string
  method: string
  input?: unknown
  payload: unknown
  options?: RouteOptions & { body?: BodyInit | null }
  $result: TResult
}

type ClientRequestResult<TResult = any> = {
  value: TResult
  status?: number
}

class ClientRequestFailure {
  constructor(
    readonly error: unknown,
    readonly status?: number
  ) {}
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
 * @remarks Actions whose schema has `response: $type<T>()` or a Zod schema
 * return parsed JSON as the inferred type. Actions whose schema has a
 * status-keyed response map return a tuple
 * union of `[null, value, status]` success entries and `[error, null, status]`
 * error entries. Actions whose schema has a plugin response marker return the
 * plugin's client result type. Actions without a response marker return the raw
 * `Response`. Raw-body actions with no path or query input accept
 * `(body, options)`; raw-body actions with route input accept
 * `(input, { body, ...options })`.
 */
export type RouteFunction<T extends RouteSchema, P extends string> = T extends {
  body: RawBodySchema
}
  ? RouteInput<T, P> extends infer TInput
    ? {} extends TInput
      ? (
          body: BodyInit | null,
          options?: RouteFetchOptions<T>
        ) => Promise<
          T extends { response: any } ? InferRouteResponse<T> : Response
        >
      : (
          input: TInput,
          options: RouteOptions<T>
        ) => Promise<
          T extends { response: any } ? InferRouteResponse<T> : Response
        >
    : never
  : (
      ...p: RouteInput<T, P> extends infer TInput
        ? {} extends TInput
          ? [input?: TInput, options?: RouteOptions<T>]
          : [input: TInput, options?: RouteOptions<T>]
        : never
    ) => Promise<T extends { response: any } ? InferRouteResponse<T> : Response>

function connectTree(
  tree: HttpRouteTree,
  prefix: string,
  namePrefix: string,
  plainRequest: (props: ClientRequest) => Promise<ClientRequestResult>,
  parsedRequest: (props: ClientRequest) => Promise<ClientRequestResult>,
  clientHook?: RouzerClientHook
): any {
  return Object.fromEntries(
    Object.entries(tree).map(([key, node]) => {
      if (node.kind === 'resource') {
        return [
          key,
          connectTree(
            node.children,
            joinPaths(prefix, node.path.source),
            joinNames(namePrefix, key),
            plainRequest,
            parsedRequest,
            clientHook
          ),
        ]
      }
      const path = RoutePattern.parse(
        joinPaths(prefix, node.path?.source ?? '')
      )
      const fetch = node.schema.response ? parsedRequest : plainRequest
      const routeName = joinNames(namePrefix, key)
      return [
        key,
        (input?: unknown, options?: RouteOptions) => {
          const payload = input
          if (isRawBodySchema(node.schema.body) && !hasRouteInput(node, path)) {
            options = { ...options, body: input as BodyInit | null }
            input = undefined
          }
          return runClientRequest(
            {
              schema: node.schema,
              path,
              routeName,
              method: node.method,
              input,
              payload,
              options,
              $result: undefined!,
            },
            fetch,
            clientHook
          )
        },
      ]
    })
  )
}

async function runClientRequest(
  request: ClientRequest,
  fetch: (props: ClientRequest) => Promise<ClientRequestResult>,
  clientHook?: RouzerClientHook
): Promise<any> {
  if (!clientHook) {
    try {
      return (await fetch(request)).value
    } catch (error) {
      throw getClientRequestFailure(error)?.error ?? error
    }
  }

  const opId = createClientOpId()
  const startTime = Date.now()
  const baseEvent = {
    opId,
    routeName: request.routeName,
    method: request.method,
    pathPattern: request.path.source,
    payload: request.payload,
  }

  emitClientHook(clientHook, {
    type: 'request.start',
    ...baseEvent,
  })

  try {
    const result = await fetch(request)
    emitClientHook(clientHook, {
      type: 'request.success',
      ...baseEvent,
      response: result.value,
      ...clientRequestStatus(result.status),
      durationMs: Date.now() - startTime,
    })
    return result.value
  } catch (error) {
    const failure = getClientRequestFailure(error)
    const eventError = failure ? failure.error : error
    emitClientHook(clientHook, {
      type: 'request.error',
      ...baseEvent,
      error: eventError,
      ...clientRequestStatus(failure?.status),
      durationMs: Date.now() - startTime,
    })
    throw eventError
  }
}

function emitClientHook(
  clientHook: RouzerClientHook,
  event: RouzerClientHookEvent
) {
  try {
    clientHook(event)
  } catch {
    // Lifecycle hooks are observability-only and must not affect requests.
  }
}

function createClientOpId() {
  nextClientOpId += 1
  return `rouzer:${Date.now().toString(36)}:${nextClientOpId.toString(36)}`
}

function getClientRequestFailure(error: unknown) {
  return error instanceof ClientRequestFailure ? error : undefined
}

function clientRequestStatus(status: number | undefined) {
  return status === undefined ? {} : { status }
}

function joinNames(left: string, right: string) {
  return [left, right].filter(Boolean).join('.')
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

function hasRouteInput(node: HttpAction, path: RoutePattern) {
  return Boolean(
    node.schema.path || node.schema.query || /(^|\/)[:*]/.test(path.source)
  )
}

function pickObjectSchemaFields(schema: z.ZodObject, input: unknown) {
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
