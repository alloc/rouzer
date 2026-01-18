import type { AdapterRequestContext, HattipHandler } from '@hattip/core'
import { RoutePattern } from '@remix-run/route-pattern'
import {
  ApplyMiddleware,
  chain,
  ExtractMiddleware,
  MiddlewareChain,
  MiddlewareTypes,
  RequestContext,
} from 'alien-middleware'
import * as z from 'zod/mini'
import { mapValues } from '../common.js'
import type { Routes, RouteSchemaMap } from '../types.js'
import type { RouteRequestHandlerMap } from './types.js'

export { chain }

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

// Internal prototype for the router instance.
class RouterObject extends MiddlewareChain {
  basePath: string | undefined

  constructor(readonly config: RouterConfig) {
    super()
    this.basePath = config.basePath?.replace(/\/?$/, '/')

    const allowOrigins = config.cors?.allowOrigins?.map(createOriginPattern)
    if (allowOrigins) {
      super.use((ctx: RequestContext) => {
        const origin = ctx.request.headers.get('Origin')
        if (
          origin &&
          allowOrigins &&
          !allowOrigins.some(pattern => pattern.test(origin))
        ) {
          return new Response(null, { status: 403 })
        }
      })
    }
  }

  use(
    ...args:
      | [Routes, RouteRequestHandlerMap]
      | Parameters<MiddlewareChain['use']>
  ): any {
    const handler =
      args.length === 1 ? super.use(args[0]) : this.useRoutes(...args)
    Object.setPrototypeOf(handler, this)
    return handler
  }

  /** @internal */
  private useRoutes(routeSchemas: Routes, handlers: RouteRequestHandlerMap) {
    const { config, basePath } = this

    const routes = Object.entries(routeSchemas).map(([name, route]) => ({
      name,
      path: basePath
        ? new RoutePattern(route.path.source.replace(/^\/?/, basePath))
        : route.path,
      methods: mapValues(route.methods, (schema, method) => {
        const handler = handlers[name][method]
        if (!handler && config.debug) {
          console.error(`Handler missing for route: ${method} ${name}`)
        }
        return {
          schema,
          handler,
        }
      }),
    }))

    return super.use(async function (
      context: RequestContext & { url?: URL; path?: {} }
    ) {
      const request = context.request as Request
      const origin = request.headers.get('Origin')
      const url = (context.url ??= new URL(request.url))

      let isPreflight = false
      let method = request.method
      if (method === 'OPTIONS') {
        isPreflight = true
        method =
          request.headers.get('Access-Control-Request-Method')?.toUpperCase() ??
          'GET'
      }

      for (const route of routes) {
        const props = route.methods.hasOwnProperty(method)
          ? route.methods[method as keyof RouteSchemaMap]
          : route.methods.ALL
        if (!props) {
          continue
        }

        const { schema, handler } = props
        if (!handler) {
          continue
        }

        const match = route.path.match(url)
        if (!match) {
          continue
        }

        if (isPreflight) {
          const optionsHandler = handlers[route.name].OPTIONS
          if (optionsHandler) {
            const response = await optionsHandler(context)
            if (response) {
              return response
            }
          }
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': origin ?? '',
              'Access-Control-Allow-Methods': method,
              'Access-Control-Allow-Headers':
                request.headers.get('Access-Control-Request-Headers') ?? '',
            },
          })
        }

        if (origin) {
          context.setHeader('Access-Control-Allow-Origin', origin)
        }

        if (schema.path) {
          const error = parsePathParams(
            context,
            enableStringParsing(schema.path),
            match.params
          )
          if (error) {
            return httpClientError(error, 'Invalid path parameter', config)
          }
        } else {
          context.path = match.params
        }

        if (schema.headers) {
          const error = parseHeaders(
            context,
            enableStringParsing(schema.headers)
          )
          if (error) {
            return httpClientError(error, 'Invalid request headers', config)
          }
        }

        if (schema.query) {
          const error = parseQueryString(
            context,
            enableStringParsing(schema.query)
          )
          if (error) {
            return httpClientError(error, 'Invalid query string', config)
          }
        }

        if (schema.body) {
          const error = await parseRequestBody(context, schema.body)
          if (error) {
            return httpClientError(error, 'Invalid request body', config)
          }
        }

        const result = await handler(context)
        if (result instanceof Response) {
          return result
        }
        return Response.json(result)
      }
    })
  }
}

export interface Router<T extends MiddlewareTypes = any>
  extends HattipHandler<T['platform']>, MiddlewareChain<T> {
  /**
   * Clone this router and add the given middleware to the end of the chain.
   *
   * @returns a new `Router` instance.
   */
  use<const TMiddleware extends ExtractMiddleware<this>>(
    middleware: TMiddleware | null
  ): Router<ApplyMiddleware<this, TMiddleware>>

  /**
   * Clone this router and add the given routes and handlers to the chain.
   *
   * @returns a new `Router` instance.
   */
  use<TRoutes extends Routes>(
    routes: TRoutes,
    handlers: RouteRequestHandlerMap<TRoutes, this>
  ): Router<T>
}

export function createRouter<
  TEnv extends object = {},
  TProperties extends object = {},
  TPlatform = unknown,
>(
  config: RouterConfig = {}
): Router<MiddlewareTypes<TEnv, TProperties, TPlatform>> {
  const router = new RouterObject(config)
  const handler = router.toHandler()
  Object.setPrototypeOf(handler, router)
  return handler as any
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
function enableStringParsing(schema: z.ZodMiniType): typeof schema {
  if (schema.type === 'optional') {
    const { def } = schema as z.ZodMiniOptional<z.ZodMiniType>
    return z.optional(enableStringParsing(def.innerType))
  }
  if (schema.type === 'number') {
    return z.pipe(z.transform(Number), schema as z.ZodMiniNumber<number>)
  }
  if (schema.type === 'boolean') {
    return z.pipe(
      z.transform(toBooleanStrict),
      schema as z.ZodMiniBoolean<boolean>
    )
  }
  if (schema.type === 'object') {
    const cachedSchema = seen.get(schema)
    if (cachedSchema) {
      return cachedSchema
    }
    const { def } = schema as z.ZodMiniObject<Record<string, z.ZodMiniType>>
    const newSchema = z.object(mapValues(def.shape, enableStringParsing))
    seen.set(schema, newSchema)
    return newSchema
  }
  if (schema.type === 'array') {
    const { def } = schema as z.ZodMiniArray<z.ZodMiniType>
    return z.array(enableStringParsing(def.element))
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

function createOriginPattern(origin: string) {
  if (!origin.includes('//')) {
    origin = `https://${origin}`
  }
  if (origin.includes('*')) {
    return new RegExp(
      `^${
        origin
          .replace(/\./g, '\\.')
          .replace(/\*:/g, '[^:]+:') // Wildcard protocol
          .replace(/\*\./g, '([^/]+\\.)?') // Wildcard subdomain
      }$`
    )
  }
  return new ExactPattern(origin)
}
