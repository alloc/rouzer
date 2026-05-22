import { $type } from 'rouzer'
import * as http from 'rouzer/http'

export const helloRoute = http.get('hello/:name', {
  response: $type<{ message: string }>(),
})
