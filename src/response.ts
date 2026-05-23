import type { Promisable } from './common.js'
import type { RouteRequest } from './types/request.js'

/** Runtime key carried by response plugin markers. */
export const responsePluginMarkerSymbol: unique symbol = Symbol.for(
  'rouzer.response-plugin'
) as any

/**
 * Compile-time response marker handled by a client/router response plugin pair.
 *
 * @remarks `TClient` is the value returned by generated client action
 * functions. `TRouter` is the non-`Response` value accepted from route handlers.
 */
export type ResponsePluginMarker<
  TClient,
  TRouter = TClient,
  TId extends string = string,
> = {
  readonly [responsePluginMarkerSymbol]: {
    readonly id: TId
    readonly client: TClient
    readonly router: TRouter
  }
}

/** Client-side response plugin used by `createClient({ plugins })`. */
export type ClientResponsePlugin = {
  /** Stable response codec id matched against route response markers. */
  readonly id: string
  /** Decode a successful `Response` into the client action result. */
  decode(
    response: Response,
    context: {
      marker: ResponsePluginMarker<any, any>
      request: RouteRequest
    }
  ): Promisable<unknown>
}

/** Router-side response plugin used by `createRouter({ plugins })`. */
export type RouterResponsePlugin = {
  /** Stable response codec id matched against route response markers. */
  readonly id: string
  /** Encode a handler result into the HTTP response. */
  encode(
    value: unknown,
    context: {
      marker: ResponsePluginMarker<any, any>
      request: Request
    }
  ): Promisable<Response>
}

/** Create a response marker for a response plugin. */
export function createResponsePluginMarker<
  TClient,
  TRouter = TClient,
  const TId extends string = string,
>(id: TId): ResponsePluginMarker<TClient, TRouter, TId> {
  return {
    [responsePluginMarkerSymbol]: {
      id,
      client: undefined!,
      router: undefined!,
    },
  }
}

/** Get the response plugin id from a plugin marker, if present. */
export function getResponsePluginMarkerId(value: unknown): string | undefined {
  return isResponsePluginMarker(value)
    ? value[responsePluginMarkerSymbol].id
    : undefined
}

/** Return true when a route response marker is handled by a response plugin. */
export function isResponsePluginMarker(
  value: unknown
): value is ResponsePluginMarker<unknown, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    responsePluginMarkerSymbol in value
  )
}

/** Create a plugin lookup map and reject duplicate plugin ids. */
export function createResponsePluginMap<
  TPlugin extends { readonly id: string },
>(plugins: readonly TPlugin[] = [], label = 'response'): Map<string, TPlugin> {
  const map = new Map<string, TPlugin>()
  for (const plugin of plugins) {
    if (map.has(plugin.id)) {
      throw new Error(`Duplicate ${label} plugin: ${plugin.id}`)
    }
    map.set(plugin.id, plugin)
  }
  return map
}
