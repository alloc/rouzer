import { $type } from 'rouzer'
import * as http from 'rouzer/http'
import * as z from 'zod'

export const validateRoute = http.get('validate/:id', {
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
})

export const submitRoute = http.post('submit', {
  body: z.object({
    count: z.number().check(z.int(), z.positive()),
  }),
  response: $type<{ ok: boolean }>(),
})

export const routes = { validateRoute, submitRoute }
