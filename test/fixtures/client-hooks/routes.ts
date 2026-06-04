import { $type } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'
import * as z from 'zod'

export const routes = {
  session: http.resource('session', {
    create: http.post('create', {
      body: z.object({
        name: z.string().min(2),
      }),
      response: $type<{ id: string }>(),
    }),
  }),
  events: http.get('events', {
    response: ndjson.$type<{ id: number }>(),
  }),
}
