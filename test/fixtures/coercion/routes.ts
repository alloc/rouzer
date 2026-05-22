import { $type } from 'rouzer'
import * as http from 'rouzer/http'
import * as z from 'zod'

export const coercionRoute = http.get('coercion/:id', {
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
})
