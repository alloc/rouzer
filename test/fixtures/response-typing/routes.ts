import { $type } from 'rouzer'
import * as http from 'rouzer/http'

export const jsonRoute = http.get('json', {
  response: $type<{ message: string }>(),
})

export const pingRoute = http.get('ping', {})
