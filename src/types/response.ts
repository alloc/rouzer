import type { ResponsePluginMarker, RouteSchema, Unchecked } from './schema.js'

/** `Response` whose `.json()` method resolves to a known payload type. */
export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

/** Infer the client response type from an action schema. */
export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: ResponsePluginMarker<infer TClient, any>
}
  ? TClient
  : T extends { response: Unchecked<infer TResponse> }
    ? TResponse
    : void

/** Infer the non-`Response` handler result type from an action schema. */
export type InferRouteHandlerResult<T extends RouteSchema> = T extends {
  response: ResponsePluginMarker<any, infer TRouter>
}
  ? TRouter
  : T extends { response: Unchecked<infer TResponse> }
    ? TResponse
    : void
