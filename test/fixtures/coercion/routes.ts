import { $type, route } from 'rouzer'
import * as z from 'zod'

export const coercionRoute = route('coercion/:id', {
  GET: {
    path: z.object({
      id: z.number(),
    }),
    query: z.object({
      value: z.number(),
      active: z.boolean(),
      optionalVal: z.optional(z.number()),
    }),
    response: $type<{
      id: number
      value: number
      active: boolean
      optionalVal?: number
    }>(),
  },
})
