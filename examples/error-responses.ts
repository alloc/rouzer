import type { HattipHandler } from '@hattip/core'
import { $error, $type, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

type User = {
  id: string
  name: string
}

type AuthError = {
  code: 'UNAUTHORIZED'
  message: string
}

type NotFoundError = {
  code: 'NOT_FOUND'
  message: string
}

export const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    201: $type<User>(),
    401: $error<AuthError>(),
    404: $error<NotFoundError>(),
  },
})

export const routes = { getUser }

/**
 * Tiny Hattip adapter used only to keep this example self-contained. Real apps
 * mount the handler with a Hattip adapter for their runtime.
 */
function createLocalFetch(handler: HattipHandler): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)
    const response = await handler({
      request,
      ip: '127.0.0.1',
      platform: undefined,
      env() {
        return undefined
      },
      passThrough() {},
      waitUntil(promise) {
        void promise
      },
    })

    return response ?? new Response(null, { status: 404 })
  }
}

export async function runErrorResponsesExample() {
  const users = new Map([['42', { id: '42', name: 'Ada' }]])

  const handler = createRouter({ basePath: 'api/' }).use(routes, {
    getUser(ctx) {
      if (ctx.path.id === 'unauthorized') {
        return ctx.error(401, {
          code: 'UNAUTHORIZED',
          message: 'Login required',
        })
      }

      if (ctx.path.id === 'created') {
        return ctx.success(201, {
          id: 'created',
          name: 'Grace',
        })
      }

      const user = users.get(ctx.path.id)
      if (!user) {
        return ctx.error(404, {
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }

      return user
    },
  })

  const client = createClient({
    baseURL: 'https://example.test/api/',
    routes,
    fetch: createLocalFetch(handler),
  })

  const found = await client.getUser({ path: { id: '42' } })
  const created = await client.getUser({ path: { id: 'created' } })
  const missing = await client.getUser({ path: { id: 'missing' } })
  const unauthorized = await client.getUser({ path: { id: 'unauthorized' } })

  return { found, created, missing, unauthorized }
}
