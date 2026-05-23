import { createRouter } from 'rouzer'
import * as ndjson from 'rouzer/ndjson'
import * as routes from './routes.js'

export default createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  getUser(ctx) {
    const id = ctx.path.id

    if (id === 'unauthorized') {
      return ctx.error(401, {
        code: 'UNAUTHORIZED',
        message: 'Login required',
      })
    }

    if (id === 'created') {
      return ctx.success(201, {
        id,
        name: 'Grace',
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
  streamUsers(ctx) {
    if (ctx.query === undefined) {
      return [
        { id: '1', name: 'Ada' },
        { id: '2', name: 'Grace' },
      ]
    }
    return ctx.error(404, {
      code: 'NOT_FOUND',
      message: 'No stream',
    })
  },
})
