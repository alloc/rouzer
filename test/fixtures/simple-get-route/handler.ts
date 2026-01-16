import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter().use(routes, {
  helloRoute: {
    GET(ctx) {
      return { message: `Hello, ${ctx.path.name}!` }
    },
  },
})
