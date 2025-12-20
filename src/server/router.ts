import type { AdapterRequestContext } from '@hattip/core'
import { RoutePattern, type Params } from '@remix-run/route-pattern'
import {
  chain,
  MiddlewareChain,
  type MiddlewareContext,
} from 'alien-middleware'
import { mapValues } from '../common.js'
import * as z from 'zod/mini'
import type {
  InferRouteResponse,
  MutationMethod,
  Promisable,
  QueryMethod,
  RouteMethods,
  Routes,
} from '../types.js'

export { chain }

type EmptyMiddlewareChain<TPlatform = unknown> = MiddlewareChain<{
  initial: {
    env: {}
    properties: {}
  }
  current: {
    env: {}
    properties: {}
  }
  platform: TPlatform
}>

export type RouterConfig = {
  /**
   * Base path to prepend to all routes.
   * @example
   * ```ts
   * basePath: 'api/',
   * ```
   */
  basePath?: string
  /**
   * Routes to match.
   * @example
   * ```ts
   * // This namespace contains your `route()` declarations.
   * // Pass it to the `createRouter` function.
   * import * as routes from './routes'
   *
   * createRouter({ routes })({
   *   // your route handlers...
   * })
   * ```
   */
  routes: Routes
  /**
   * Middleware to apply to all routes.
   * @see https://github.com/alien-rpc/alien-middleware#quick-start
   * @example
   * ```ts
   * middlewares: chain().use(ctx => {
   *   return {
   *     db: postgres(ctx.env('POSTGRES_URL')),
   *   }
   * }),
   * ```
   */
  middlewares?: MiddlewareChain
  /**
   * Enable debugging features.
   * - When a handler throws an error, include its message in the response body.
   * - Throw an error if a handler is not found for a route.
   * @example
   * ```ts
   * debug: process.env.NODE_ENV !== 'production',
   * ```
   */
  debug?: boolean
  /**
   * CORS configuration.
   */
  cors?: {
    /**
     * If defined, requests must have an `Origin` header that is in this list.
     *
     * Origins may contain wildcards for protocol and subdomain. The protocol is
     * optional and defaults to `https`.
     *
     * @example
     * ```ts
     * allowOrigins: ['example.net', 'https://*.example.com', '*://localhost:3000']
     * ```
     */
    allowOrigins?: string[]
  }
}

interface CreateRouterConfig<
  TRoutes extends Routes,
  TMiddleware extends MiddlewareChain,
> extends RouterConfig {
  routes: TRoutes
  middlewares?: TMiddleware
}

export function createRouter<
  TRoutes extends Routes,
  TMiddleware extends MiddlewareChain = EmptyMiddlewareChain,
>(config: CreateRouterConfig<TRoutes, TMiddleware>) {
  const keys = Object.keys(config.routes)
  const middlewares = config.middlewares ?? (chain() as TMiddleware)

  const basePath = config.basePath?.replace(/\/?$/, '/')
  const patterns = mapValues(config.routes, ({ path }) =>
    basePath ? new RoutePattern(path.source.replace(/^\/?/, basePath)) : path
  )

  const allowOrigins = config.cors?.allowOrigins?.map(origin => {
    if (!origin.includes('//')) {
      origin = `https://${origin}`
    }
    if (origin.includes('*')) {
      return new RegExp(
        `^${
          origin
            .replace(/\./g, '\\.')
            .replace(/\*:/g, '[^:]+:') // Wildcard protocol
            .replace(/\*\\\./g, '([^/]+\\.)?') // Wildcard subdomain
        }$`
      )
    }
    return new ExactPattern(origin)
  })

  type RequestContext = MiddlewareContext<TMiddleware>

  type RequestHandler<TArgs extends object, TResult> = (
    context: RequestContext & TArgs
  ) => Promisable<TResult | Response>

  type InferRequestHandler<T, P extends string> = T extends QueryMethod
    ? RequestHandler<
        {
          path: T extends { path: any } ? z.infer<T['path']> : Params<P>
          query: z.infer<T['query']>
          headers: z.infer<T['headers']>
        },
        InferRouteResponse<T>
      >
    : T extends MutationMethod
      ? RequestHandler<
          {
            path: T extends { path: any } ? z.infer<T['path']> : Params<P>
            body: z.infer<T['body']>
            headers: z.infer<T['headers']>
          },
          InferRouteResponse<T>
        >
      : never

  type RequestHandlers = {
    [K in keyof TRoutes]: {
      [M in keyof TRoutes[K]['methods']]: InferRequestHandler<
        TRoutes[K]['methods'][M],
        TRoutes[K]['path']['source']
      >
    }
  }

  type TPlatform =
    TMiddleware extends MiddlewareChain<infer T> ? T['platform'] : never

  return (handlers: RequestHandlers) =>
    middlewares.use(async function (
      context: AdapterRequestContext<TPlatform> & {
        url?: URL
        path?: {}
      }
    ) {
      const request = context.request as Request
      const url: URL = (context.url ??= new URL(request.url))

      let method = request.method.toUpperCase()
      let isPreflight = false
      if (method === 'OPTIONS') {
        method = request.headers.get('Access-Control-Request-Method') ?? 'GET'
        isPreflight = true
      }

      for (let i = 0; i < keys.length; i++) {
        const route =
          config.routes[keys[i]].methods[method as keyof RouteMethods]
        if (!route) {
          continue
        }

        const match = patterns[keys[i]].match(url)
        if (!match) {
          continue
        }

        const handler = handlers[keys[i]][method as keyof RouteMethods]
        if (!handler) {
          if (config.debug) {
            throw new Error(`Handler not found for route: ${keys[i]} ${method}`)
          }
          continue
        }

        if (isPreflight) {
          const origin = request.headers.get('Origin')
          if (
            allowOrigins &&
            !(origin && allowOrigins.some(pattern => pattern.test(origin)))
          ) {
            return new Response(null, { status: 403 })
          }
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': origin ?? '*',
              'Access-Control-Allow-Methods': method,
              'Access-Control-Allow-Headers':
                request.headers.get('Access-Control-Request-Headers') ?? '',
            },
          })
        }

        if (route.path) {
          const error = parsePathParams(
            context,
            enableStringParsing(route.path),
            match.params
          )
          if (error) {
            return httpClientError(error, 'Invalid path parameter', config)
          }
        } else {
          context.path = match.params
        }

        if (route.headers) {
          const error = parseHeaders(
            context,
            enableStringParsing(route.headers)
          )
          if (error) {
            return httpClientError(error, 'Invalid request headers', config)
          }
        }

        if (route.query) {
          const error = parseQueryString(
            context,
            enableStringParsing(route.query)
          )
          if (error) {
            return httpClientError(error, 'Invalid query string', config)
          }
        }

        if (route.body) {
          const error = await parseRequestBody(context, route.body)
          if (error) {
            return httpClientError(error, 'Invalid request body', config)
          }
        }

        const result = await handler(context as any)
        if (result instanceof Response) {
          return result
        }
        return Response.json(result)
      }
    })
}

function httpClientError(
  error: any,
  message: string,
  config: { debug?: boolean }
) {
  return Response.json(
    {
      ...error,
      message: config.debug ? `${message}: ${error.message}` : message,
    },
    { status: 400 }
  )
}

function parsePathParams(
  context: AdapterRequestContext & { path?: {} },
  schema: z.ZodMiniType<any, any>,
  params: {}
) {
  const result = schema.safeParse(params)
  if (!result.success) {
    return result.error
  }
  context.path = result.data
  return null
}

function parseHeaders(
  context: AdapterRequestContext & { headers?: {} },
  schema: z.ZodMiniType<any, any>
) {
  const headers = Object.fromEntries(context.request.headers as any)
  const result = schema.safeParse(headers)
  if (!result.success) {
    return result.error
  }
  context.headers = result.data
  return null
}

function parseQueryString(
  context: AdapterRequestContext & { url?: URL; query?: {} },
  schema: z.ZodMiniType<any, any>
) {
  const result = schema.safeParse(
    Object.fromEntries(context.url!.searchParams as any)
  )
  if (!result.success) {
    return result.error
  }
  context.query = result.data
  return null
}

async function parseRequestBody(
  context: AdapterRequestContext & { body?: {} },
  schema: z.ZodMiniType<any, any>
) {
  const result = await context.request.json().then(
    body => schema.safeParse(body),
    error => ({ success: false, error }) as const
  )
  if (!result.success) {
    return result.error
  }
  context.body = result.data
  return null
}

const seen = new WeakMap<z.ZodMiniType<any, any>, z.ZodMiniType<any, any>>()

/**
 * Traverse object and array schemas, finding schemas that expect a number or
 * boolean, and replace those schemas with a new schema that parses the input
 * value as a number or boolean.
 */
function enableStringParsing(schema: z.ZodMiniType<any, any>): typeof schema {
  if (schema.type === 'number') {
    return z.pipe(z.transform(Number), schema)
  }
  if (schema.type === 'boolean') {
    return z.pipe(z.transform(toBooleanStrict), schema)
  }
  if (schema.type === 'object') {
    const cached = seen.get(schema)
    if (cached) {
      return cached
    }
    const modified = z.object(
      mapValues((schema as z.ZodMiniObject<any>).def.shape, enableStringParsing)
    )
    seen.set(schema, modified)
    return modified
  }
  if (schema.type === 'array') {
    return z.array(
      enableStringParsing((schema as z.ZodMiniArray<any>).def.element)
    )
  }
  return schema
}

function toBooleanStrict(value: string) {
  return value === 'true' || (value === 'false' ? false : value)
}

class ExactPattern {
  constructor(private readonly value: string) {}
  test(input: string) {
    return input === this.value
  }
}
