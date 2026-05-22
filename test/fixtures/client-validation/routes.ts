import { route } from 'rouzer'
import * as z from 'zod'

export const queryRoute = route('query', {
  GET: {
    query: z.object({
      q: z.string().check(z.minLength(2)),
    }),
  },
})

export const bodyRoute = route('body', {
  POST: {
    body: z.object({
      count: z.number().check(z.int(), z.positive()),
    }),
  },
})

export const headerRoute = route('headers', {
  GET: {
    headers: z.object({
      'x-token': z.string().check(z.minLength(3)),
    }),
  },
})
