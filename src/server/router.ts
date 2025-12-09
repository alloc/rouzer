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
  MutationRoute,
  Promisable,
  QueryRoute,
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

export type RouterConfig<
  TRoutes extends Record<string, { path: string; routes: Routes }> = any,
  TMiddleware extends MiddlewareChain = any,
> = {
  routes: TRoutes
  middlewares?: TMiddleware
  debug?: boolean
}

export function createRouter<
  TRoutes extends Record<string, { path: string; routes: Routes }>,
  TMiddleware extends MiddlewareChain = EmptyMiddlewareChain,
>(config: { routes: TRoutes; middlewares?: TMiddleware; debug?: boolean }) {
  const keys = Object.keys(config.routes)
  const middlewares = config.middlewares ?? (chain() as TMiddleware)
  const patterns = mapValues(
    config.routes,
    ({ path }) => new RoutePattern(path)
  )

  type RequestContext = MiddlewareContext<TMiddleware>

  type RequestHandler<TArgs extends object, TResult> = (
    context: RequestContext & TArgs
  ) => Promisable<TResult | Response>

  type InferRequestHandler<T, P extends string> = T extends QueryRoute
    ? RequestHandler<
        {
          query: z.infer<T['query']>
          params: Params<P>
          headers: z.infer<T['headers']>
        },
        InferRouteResponse<T>
      >
    : T extends MutationRoute
      ? RequestHandler<
          {
            body: z.infer<T['body']>
            params: Params<P>
            headers: z.infer<T['headers']>
          },
          InferRouteResponse<T>
        >
      : never

  type RequestHandlers = {
    [K in keyof TRoutes]: {
      [M in keyof TRoutes[K]['routes']]: InferRequestHandler<
        TRoutes[K]['routes'][M],
        TRoutes[K]['path']
      >
    }
  }

  type TPlatform =
    TMiddleware extends MiddlewareChain<infer T> ? T['platform'] : never

  return (handlers: RequestHandlers) =>
    middlewares.use(async function (
      context: AdapterRequestContext<TPlatform> & {
        url?: URL
        params?: {}
      }
    ) {
      const request = context.request as Request
      const method = request.method.toUpperCase() as keyof Routes
      const url: URL = (context.url ??= new URL(request.url))

      for (let i = 0; i < keys.length; i++) {
        const pattern = patterns[keys[i]]

        const match = pattern.match(url)
        if (!match) {
          continue
        }

        const route = config.routes[keys[i]].routes[method]
        if (!route) {
          continue
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

        const handler = handlers[keys[i]][method]
        if (!handler) {
          continue
        }

        context.params = match.params

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
