import { mapValues, Promisable, shake } from '../common.js'
import { Route } from '../route.js'
import type {
  InferRouteResponse,
  RouteArgs,
  RouteRequest,
  RouteSchema,
} from '../types.js'

/** Client type inferred from a route map passed to `createClient`. */
export type RouzerClient<
  TRoutes extends Record<string, Route> = Record<string, never>,
> = ReturnType<typeof createClient<TRoutes>>

/**
 * Create a typed fetch client for Rouzer route declarations.
 *
 * @remarks The returned client always includes `request(...)` for raw responses
 * and `json(...)` for parsed JSON. Passing `routes` also attaches shorthand
 * methods such as `client.helloRoute.GET(...)`.
 */
export function createClient<
  TRoutes extends Record<string, Route> = Record<string, never>,
>(config: {
  /**
   * Absolute base URL used for pathname route patterns.
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
   * Route map to attach as shorthand methods on the client.
   *
   * @example
   * ```ts
   * const client = createClient({ baseURL: 'https://example.com/api/', routes })
   * await client.helloRoute.GET({ path: { name: 'world' } })
   * ```
   */
  routes?: TRoutes
  /**
   * Custom handler for non-2xx responses from `.json()`.
   *
   * @remarks When provided, the return value is returned from `.json()` as-is;
   * Rouzer does not automatically parse a `Response` returned by this hook.
   * Without this hook, `.json()` throws an `Error` and copies JSON error-body
   * properties onto it when the response has a JSON content type.
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
      url = new URL(href)
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
      ? mapValues(config.routes, route => connectRoute(route, request, json))
      : null) as unknown as {
      [K in keyof TRoutes]: TRoutes[K]['methods'] extends infer TMethods
        ? {
            [M in keyof TMethods]: RouteFunction<
              Extract<TMethods[M], RouteSchema>,
              TRoutes[K]['path']['source']
            >
          }
        : never
    }),
    config,
    request,
    json,
  }
}

/**
 * Shorthand client method attached for each route method when `routes` is passed
 * to `createClient`.
 *
 * @remarks Methods whose schema has `response: $type<T>()` return parsed JSON as
 * `T`. Methods without a response marker return the raw `Response`.
 */
export type RouteFunction<T extends RouteSchema, P extends string> = (
  ...p: RouteArgs<T, P> extends infer TArgs
    ? {} extends TArgs
      ? [args?: TArgs]
      : [args: TArgs]
    : never
) => Promise<T extends { response: any } ? InferRouteResponse<T> : Response>

function connectRoute(
  route: Route,
  request: (props: RouteRequest) => Promise<Response>,
  json: (props: RouteRequest) => Promise<any>
) {
  return {
    ...route,
    ...mapValues(route.methods, (schema, key) => {
      const fetch = schema.response ? json : request
      return (args: RouteArgs) => fetch(route[key]!(args))
    }),
  }
}
