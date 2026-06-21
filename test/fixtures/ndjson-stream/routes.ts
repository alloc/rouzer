import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'
import { z } from 'zod'

export type Event = {
  id: number
  message: string
}

export const events = http.get('events', {
  response: ndjson.$type<Event>(),
})

export const stream = http.post('stream', {
  body: z.object({
    names: z.array(z.string()),
    where: z.array(
      z.object({
        path: z.string(),
        equals: z.string(),
      })
    ),
  }),
  response: ndjson.$type<Event>(),
})

export const fails = http.get('fails', {
  response: ndjson.$type<Event>(),
})

export const routes = { events, stream, fails }
