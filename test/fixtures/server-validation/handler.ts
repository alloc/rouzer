import { createRouter } from 'rouzer'
import { routes } from './routes.js'

export default createRouter({ routes })({
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
