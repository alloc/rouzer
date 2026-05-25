import * as http from 'rouzer/http'
import * as z from 'zod'

export const queryRoute = http.get('query', {
  query: z.object({
    q: z.string().check(z.minLength(2)),
  }),
})

export const bodyRoute = http.post('body', {
  body: z.object({
    count: z.number().check(z.int(), z.positive()),
  }),
})

export const rawBodyRoute = http.post('raw/:id', {
  body: http.rawBody(),
})

export const headerRoute = http.get('headers', {
  headers: z.object({
    'x-token': z.string().check(z.minLength(3)),
  }),
})

export const config = http.get('config', {})
