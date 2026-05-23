import { createRouter } from 'rouzer'
import * as routes from './routes.js'

export default createRouter().use(routes, {
  getUser(ctx) {
    const id = ctx.path.id

    if (id === 'unauthorized') {
      return ctx.error(401, {
        code: 'UNAUTHORIZED',
        message: 'Login required',
      })
    }

    if (id === 'missing') {
      return ctx.error(404, {
        code: 'NOT_FOUND',
        message: 'User not found',
      })
    }

    return {
      id,
      name: 'Ada',
    }
  },
})
