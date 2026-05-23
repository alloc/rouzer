import type { NdjsonResponse, RouteSchema, Unchecked } from './schema.js'

/** `Response` whose `.json()` method resolves to a known payload type. */
export type RouteResponse<TResult = any> = Response & {
  json(): Promise<TResult>
}

/** Infer the client response type from an action schema. */
export type InferRouteResponse<T extends RouteSchema> = T extends {
  response: NdjsonResponse<infer TItem>
}
  ? AsyncIterable<TItem>
  : T extends { response: Unchecked<infer TResponse> }
    ? TResponse
    : void
