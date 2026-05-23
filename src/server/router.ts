import type { AdapterRequestContext, HattipHandler } from '@hattip/core'
import { RoutePattern } from '@remix-run/route-pattern'
import { createMatcher, type Matcher } from '@remix-run/route-pattern/match'
import {
  ApplyMiddleware,
  chain,
  ExtractMiddleware,
  MiddlewareChain,
  MiddlewareTypes,
  RequestContext,
} from 'alien-middleware'
import * as z from 'zod'
import { mapValues } from '../common.js'
import type { HttpRouteTree } from '../http.js'
import {
  createResponsePluginMap,
  getResponsePluginMarkerId,
  type ResponsePluginMarker,
  type RouterResponsePlugin,
} from '../response.js'
import {
  getDefaultSuccessStatus,
  getResponseMapPluginIds,
  isErrorMarker,
  isResponseMap,
} from '../response-map.js'
import type { RouteResponseMap, RouteSchema } from '../types/schema.js'
import type { RouteRequestHandlerMap } from '../types/server.js'

export { chain }

/** Configuration for `createRouter`. */
export type RouterConfig = {
  /**
   * Base path to prepend to all route patterns.
   *
   * @remarks Leading and trailing slashes are normalized so `api`, `/api`, and
   * `api/` all mount routes under `/api/`.
   *
   * @example
   * ```ts
   * createRouter({ basePath: 'api/' })
   * ```
   */
  basePath?: string
  /**
   * Enable debug behavior for local development.
   *
   * @remarks Debug mode adds an `X-Route-Name` response header for matched
   * routes, includes specific Zod error messages in `400` validation responses,
   * and logs missing route handlers to the console.
   */
  debug?: boolean
  /** Response codec plugins used for route handler results. */
  plugins?: readonly RouterResponsePlugin[]
  /** CORS configuration for requests with an `Origin` header. */
  cors?: {
    /**
     * Allowed origins for CORS requests.
     *
     * @remarks Origins may contain wildcards for protocol and subdomain. The
     * protocol is optional and defaults to `https`. Requests with an `Origin`
     * header outside this list receive `403`.
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
  readonly responsePlugins: Map<string, RouterResponsePlugin>

  constructor(readonly config: RouterConfig) {
    super()
    this.basePath = config.basePath?.replace(/\/?$/, '/')
    this.responsePlugins = createResponsePluginMap(
      config.plugins,
      'router response'
    )

    const allowOrigins = config.cors?.allowOrigins?.map(createOriginPattern)
    if (allowOrigins) {
      super.use(((ctx: RequestContext) => {
        const origin = ctx.request.headers.get('Origin')
        if (
          origin &&
          allowOrigins &&
          !allowOrigins.some(pattern => pattern.test(origin))
        ) {
          return new Response(null, { status: 403 })
        }
      }) as any)
    }
  }

  use(
    ...args:
      | [HttpRouteTree, RouteRequestHandlerMap]
      | Parameters<MiddlewareChain['use']>
  ): any {
    const handler =
      args.length === 1 ? super.use(args[0] as any) : this.useRoutes(...args)
    Object.setPrototypeOf(handler, this)
    return handler
  }

  /** @internal */
  private useRoutes(
    routeSchemas: HttpRouteTree,
    handlers: RouteRequestHandlerMap
  ) {
    const { config, basePath, responsePlugins } = this

    const routes = flattenRoutes(
      routeSchemas,
      handlers,
      basePath ?? '',
      config.debug
    )
    validateRouterResponsePlugins(routes, responsePlugins)

    const addDebugHeaders = config.debug
      ? (context: RequestContext, route: { name: string }) => {
          context.setHeader('X-Route-Name', route.name)
        }
      : null

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
        if (route.method !== method) {
          continue
        }

        const { schema, handler } = route
        if (!handler) {
          continue
        }

        const match = route.matcher.match(url)
        if (!match) {
          continue
        }

        if (isPreflight) {
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
            addDebugHeaders?.(context, route)
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
            addDebugHeaders?.(context, route)
            return httpClientError(error, 'Invalid request headers', config)
          }
        }

        if (schema.query) {
          const error = parseQueryString(
            context,
            enableStringParsing(schema.query)
          )
          if (error) {
            addDebugHeaders?.(context, route)
            return httpClientError(error, 'Invalid query string', config)
          }
        }

        if (schema.body) {
          const error = await parseRequestBody(context, schema.body)
          if (error) {
            addDebugHeaders?.(context, route)
            return httpClientError(error, 'Invalid request body', config)
          }
        }

        if (isResponseMap(schema.response)) {
          ;(context as any).error = createResponseHelper(
            schema.response,
            request,
            responsePlugins,
            true
          )
          ;(context as any).success = createResponseHelper(
            schema.response,
            request,
            responsePlugins,
            false
          )
        }

        const result = await handler(context)
        addDebugHeaders?.(context, route)
        if (result instanceof Response) {
          return result
        }
        const pluginId = getResponsePluginMarkerId(schema.response)
        if (pluginId) {
          const plugin = responsePlugins.get(pluginId)
          if (!plugin) {
            throw missingRouterResponsePlugin(pluginId)
          }
          return plugin.encode(result, {
            marker: schema.response as ResponsePluginMarker<any, any>,
            request,
          })
        }
        if (isResponseMap(schema.response)) {
          const status = getDefaultSuccessStatus(schema.response)
          return encodeResponseMapResult(
            schema.response,
            status,
            result,
            request,
            responsePlugins
          )
        }
        return Response.json(result)
      }
    } as any)
  }
}

/**
 * Hattip-compatible Rouzer handler with chainable middleware and route
 * registration.
 */
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
   * Clone this router and add the given HTTP route tree and handlers to the
   * chain.
   *
   * @remarks The handler object mirrors the resource tree. Resource nodes are
   * nested objects, and action nodes are direct handler functions.
   *
   * @returns a new `Router` instance.
   */
  use<TRoutes extends HttpRouteTree>(
    routes: TRoutes,
    handlers: RouteRequestHandlerMap<TRoutes, this>
  ): Router<T>
}

/**
 * Create a Rouzer router that can be mounted by any Hattip adapter.
 *
 * @param config Optional router configuration for base path, debug behavior,
 * response plugins, and CORS origin restrictions.
 * @returns A Hattip-compatible handler with `.use(...)` methods for middleware
 * and route registration.
 */
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

function flattenRoutes(
  tree: HttpRouteTree,
  handlers: any,
  prefix: string,
  debug?: boolean
): Array<{
  name: string
  path: RoutePattern
  matcher: Matcher
  method: string
  schema: RouteSchema
  handler: Function
}> {
  const routes: Array<any> = []
  for (const [name, node] of Object.entries(tree)) {
    if (node.kind === 'resource') {
      routes.push(
        ...flattenRoutes(
          node.children,
          handlers[name],
          joinPaths(prefix, node.path.source),
          debug
        )
      )
    } else {
      const handler = handlers[name]
      if (!handler && debug) {
        console.error(`Handler missing for route: ${node.method} ${name}`)
      }
      routes.push({
        name,
        path: RoutePattern.parse(joinPaths(prefix, node.path?.source ?? '')),
        matcher: createMatcher(joinPaths(prefix, node.path?.source ?? '')),
        method: node.method,
        schema: node.schema,
        handler,
      })
    }
  }
  return routes
}

function validateRouterResponsePlugins(
  routes: Array<{ schema: RouteSchema }>,
  plugins: Map<string, RouterResponsePlugin>
) {
  for (const route of routes) {
    const pluginIds = isResponseMap(route.schema.response)
      ? getResponseMapPluginIds(route.schema.response)
      : [getResponsePluginMarkerId(route.schema.response)].filter(
          pluginId => pluginId !== undefined
        )
    for (const pluginId of pluginIds) {
      if (!plugins.has(pluginId)) {
        throw missingRouterResponsePlugin(pluginId)
      }
    }
  }
}

function missingRouterResponsePlugin(pluginId: string) {
  return new Error(`Missing router response plugin for ${pluginId}`)
}

function joinPaths(left: string, right: string) {
  return [left, right].filter(Boolean).join('/').replace(/\/+/g, '/')
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
  schema: z.ZodType<any, any>,
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
  schema: z.ZodType<any, any>
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
  schema: z.ZodType<any, any>
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
  schema: z.ZodType<any, any>
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

const seen = new WeakMap<z.ZodType<any, any>, z.ZodType<any, any>>()

/**
 * Traverse object and array schemas, finding schemas that expect a number or
 * boolean, and replace those schemas with a new schema that parses the input
 * value as a number or boolean.
 */
function enableStringParsing(schema: z.ZodType): typeof schema {
  if (schema.type === 'optional') {
    const { def } = schema as z.ZodOptional<z.ZodType>
    return z.optional(enableStringParsing(def.innerType))
  }
  if (schema.type === 'number') {
    return z.pipe(z.transform(Number), schema as z.ZodNumber)
  }
  if (schema.type === 'boolean') {
    return z.pipe(z.transform(toBooleanStrict), schema as z.ZodBoolean)
  }
  if (schema.type === 'object') {
    const cachedSchema = seen.get(schema)
    if (cachedSchema) {
      return cachedSchema
    }
    const { def } = schema as z.ZodObject<Record<string, z.ZodType>>
    const newSchema = z.object(mapValues(def.shape, enableStringParsing))
    seen.set(schema, newSchema)
    return newSchema
  }
  if (schema.type === 'array') {
    const { def } = schema as z.ZodArray<z.ZodType>
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

/** Create `ctx.error(status, body)` or `ctx.success(status, body)`. */
function createResponseHelper(
  responseMap: RouteResponseMap,
  request: Request,
  responsePlugins: Map<string, RouterResponsePlugin>,
  error: boolean
) {
  return (status: number, body: unknown): Promise<Response> | Response => {
    const marker = responseMap[status]
    if (!marker || isErrorMarker(marker) !== error) {
      throw new Error(
        `Undeclared ${error ? 'error' : 'success'} response status: ${status}`
      )
    }
    return encodeResponseMapResult(
      responseMap,
      status,
      body,
      request,
      responsePlugins
    )
  }
}

async function encodeResponseMapResult(
  responseMap: RouteResponseMap,
  status: number,
  value: unknown,
  request: Request,
  responsePlugins: Map<string, RouterResponsePlugin>
): Promise<Response> {
  const marker = responseMap[status]
  if (!marker) {
    throw new Error(`Undeclared response status: ${status}`)
  }
  if (isErrorMarker(marker)) {
    return Response.json(value, { status })
  }
  const pluginId = getResponsePluginMarkerId(marker)
  if (!pluginId) {
    return Response.json(value, { status })
  }
  const plugin = responsePlugins.get(pluginId)
  if (!plugin) {
    throw missingRouterResponsePlugin(pluginId)
  }
  const response = await plugin.encode(value, {
    marker: marker as ResponsePluginMarker<any, any>,
    request,
  })
  return new Response(response.body, {
    status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
