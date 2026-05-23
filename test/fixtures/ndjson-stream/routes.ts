import { $ndjson } from 'rouzer'
import * as http from 'rouzer/http'

export type Event = {
  id: number
  message: string
}

export const events = http.get('events', {
  response: $ndjson<Event>(),
})

export const fails = http.get('fails', {
  response: $ndjson<Event>(),
})

export const routes = { events, fails }
