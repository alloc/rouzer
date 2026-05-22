import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter().use(routes, {
  jsonRoute() {
    return { message: 'ok' }
  },
  pingRoute() {
    return new Response('pong')
  },
})
