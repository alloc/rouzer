import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter({ routes })({
  helloRoute: {
    GET(ctx) {
      return { message: `Hello, ${ctx.path.name}!` }
    },
  },
})
