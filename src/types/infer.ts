import type * as z from 'zod'
import type { MutationRouteSchema, RouteSchema } from './schema.js'
import type { RouteRequestFactory } from './request.js'

type InferRouteSchemaBody<TSchema> = TSchema extends MutationRouteSchema
  ? TSchema extends { body: infer TBody }
    ? z.infer<TBody>
    : unknown
  : never

type InferRouteArgsBody<TArgs> = TArgs extends { body?: infer TBody }
  ? TBody
  : never

/**
 * Infer the request body type from an action schema or request factory.
 *
 * @remarks HTTP action schemas can be inspected with
 * `InferRouteBody<typeof action.schema>`. Request factories for mutation actions
 * infer their `body` argument type. Schemas without a body schema infer
 * `unknown`.
 */
export type InferRouteBody<T> =
  T extends RouteRequestFactory<any, any>
    ? InferRouteArgsBody<T['$args']>
    : T extends RouteSchema
      ? InferRouteSchemaBody<T>
      : never
