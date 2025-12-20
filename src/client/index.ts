import { shake } from '../common.js'
import type { Promisable, RouteRequest } from '../types.js'

export function createClient(config: {
  /**
   * Base URL to use for all requests.
   */
  baseURL: string
  /**
   * Default headers to send with every request.
   */
  headers?: Record<string, string>
  /**
   * Custom handler for non-200 response to a `.json()` request. By default, the
   * response is always parsed as JSON, regardless of the HTTP status code.
   */
  onJsonError?: (response: Response) => Promisable<Response>
}) {
  const baseURL = config.baseURL.replace(/\/$/, '')

  return {
    config,
    request<T extends RouteRequest>({
      path: pathBuilder,
      method,
      args: { path, query, body, headers },
      route,
    }: T) {
      if (route.path) {
        path = route.path.parse(path)
      }

      let url: URL

      const href = pathBuilder.href(path)
      if (href[0] === '/') {
        url = new URL(baseURL)
        url.pathname += pathBuilder.href(path)
      } else {
        url = new URL(href)
      }

      if (route.query) {
        query = route.query.parse(query ?? {})
        url.search = new URLSearchParams(query).toString()
      } else if (query) {
        throw new Error('Unexpected query parameters')
      }
      if (route.body) {
        body = route.body.parse(body !== undefined ? body : {})
      } else if (body !== undefined) {
        throw new Error('Unexpected body')
      }

      if (config.headers || headers) {
        headers = {
          ...config.headers,
          ...(headers && shake(headers)),
        }
      }

      if (route.headers) {
        headers = route.headers.parse(headers) as any
      }

      return fetch(url, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers: headers as HeadersInit,
      }) as Promise<Response & { json(): Promise<T['$result']> }>
    },
    async json<T extends RouteRequest>(request: T): Promise<T['$result']> {
      const response = await this.request(request)
      if (!response.ok && config.onJsonError) {
        return config.onJsonError(response)
      }
      return response.json()
    },
  }
}
