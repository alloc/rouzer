import { createRouter } from 'rouzer'
import { routes } from './routes.js'

export default createRouter().use(routes, {
  validateRoute() {
    return { ok: true }
  },
  submitRoute() {
    return { ok: true }
  },
})
