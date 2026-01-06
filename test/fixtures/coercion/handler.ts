import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter({ routes })({
  coercionRoute: {
    GET(ctx) {
      return {
        id: ctx.path.id,
        value: ctx.query.value,
        active: ctx.query.active,
        optionalVal: ctx.query.optionalVal,
      }
    },
  },
})
