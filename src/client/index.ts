import { mapValues, shake } from '../common.js'
import { Route } from '../route.js'
import type {
  InferRouteResponse,
  Promisable,
  RouteArgs,
  RouteRequest,
  RouteSchema,
} from '../types.js'

export type RouzerClient<
  TRoutes extends Record<string, Route> = Record<string, never>,
> = ReturnType<typeof createClient<TRoutes>>

export function createClient<
  TRoutes extends Record<string, Route> = Record<string, never>,
>(config: {
  /**
   * Base URL to use for all requests.
   */
  baseURL: string
  /**
   * Default headers to send with every request.
   */
  headers?: Record<string, string>
  /**
   * Pass in routes to attach them as methods on the client.
   * @example
   * ```ts
   * const client = createClient({ baseURL: '/api/', routes: { helloRoute } })
   * client.helloRoute.GET({ path: { name: 'world' } })
   * ```
   */
  routes?: TRoutes
  /**
   * Custom handler for non-200 response to a `.json()` request. By default, the
   * response is always parsed as JSON, regardless of the HTTP status code.
   */
  onJsonError?: (response: Response) => Promisable<Response>
}) {
  const baseURL = config.baseURL.replace(/\/$/, '')

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
      url.pathname += pathBuilder.href(path)
    } else {
      url = new URL(href)
    }

    if (schema.query) {
      query = schema.query.parse(query ?? {})
      url.search = new URLSearchParams(query).toString()
    } else if (query) {
      throw new Error('Unexpected query parameters')
    }
    if (schema.body) {
      body = schema.body.parse(body !== undefined ? body : {})
    } else if (body !== undefined) {
      throw new Error('Unexpected body')
    }

    if (config.headers || headers) {
      headers = {
        ...config.headers,
        ...(headers && shake(headers)),
      }
    }

    if (schema.headers) {
      headers = schema.headers.parse(headers) as any
    }

    return fetch(url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: headers as HeadersInit,
    }) as Promise<Response & { json(): Promise<T['$result']> }>
  }

  async function json<T extends RouteRequest>(props: T): Promise<T['$result']> {
    const response = await request(props)
    if (!response.ok && config.onJsonError) {
      return config.onJsonError(response)
    }
    return response.json()
  }

  return {
    ...((config.routes
      ? mapValues(config.routes, route => connectRoute(route, request, json))
      : null) as unknown as {
      [K in keyof TRoutes]: TRoutes[K]['methods'] extends infer TMethods
        ? {
            [M in keyof TMethods]: RouteRequestFunction<
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

type RouteRequestFunction<T extends RouteSchema, P extends string> = (
  args: RouteArgs<T, P>
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
