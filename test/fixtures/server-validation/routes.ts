import { $type, route } from 'rouzer'
import * as z from 'zod/mini'

export const validateRoute = route('validate/:id', {
  GET: {
    path: z.object({
      id: z.string().check(z.minLength(2)),
    }),
    query: z.object({
      q: z.string().check(z.minLength(2)),
    }),
    headers: z.object({
      'x-token': z.string().check(z.minLength(3)),
    }),
    response: $type<{ ok: boolean }>(),
  },
})

export const submitRoute = route('submit', {
  POST: {
    body: z.object({
      count: z.number().check(z.int(), z.positive()),
    }),
    response: $type<{ ok: boolean }>(),
  },
})

export const routes = { validateRoute, submitRoute }
