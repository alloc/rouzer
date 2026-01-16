import { createRouter } from 'rouzer'
import { routes } from './routes.js'

export default createRouter().use(routes, {
  validateRoute: {
    GET() {
      return { ok: true }
    },
  },
  submitRoute: {
    POST() {
      return { ok: true }
    },
  },
})
