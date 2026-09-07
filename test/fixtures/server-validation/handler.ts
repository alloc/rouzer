import { createRouter } from 'rouzer'
import { routes } from './routes.js'

export default createRouter().use(routes, {
  validateRoute(ctx) {
    return { ok: true, q: ctx.query.q }
  },
  submitRoute() {
    return { ok: true }
  },
})
