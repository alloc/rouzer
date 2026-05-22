import type { Unchecked, RouteSchema } from './schema.js'

/** `Response` whose `.json()` method resolves to a known payload type. */
export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

/** Infer the JSON response payload type from an action schema. */
export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: Unchecked<infer TResponse>
}
  ? TResponse
  : void
