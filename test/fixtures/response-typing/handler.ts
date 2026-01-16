import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter().use(routes, {
  jsonRoute: {
    GET() {
      return { message: 'ok' }
    },
  },
  pingRoute: {
    GET() {
      return new Response('pong')
    },
  },
})
