import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

export type Event = {
  id: number
  message: string
}

export const events = http.get('events', {
  response: ndjson.$type<Event>(),
})

export const fails = http.get('fails', {
  response: ndjson.$type<Event>(),
})

export const routes = { events, fails }
