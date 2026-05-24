import type * as z from 'zod'
import type { MutationRouteSchema, RouteSchema } from './schema.js'

type InferRouteSchemaBody<TSchema> = TSchema extends MutationRouteSchema
  ? TSchema extends { body: infer TBody }
    ? z.infer<TBody>
    : unknown
  : never

/**
 * Infer the request body type from an action schema.
 *
 * @remarks HTTP action schemas can be inspected with
 * `InferRouteBody<typeof action.schema>`. Schemas without a body schema infer
 * `unknown`.
 */
export type InferRouteBody<T> = T extends RouteSchema
  ? InferRouteSchemaBody<T>
  : never
