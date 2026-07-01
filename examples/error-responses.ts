import {
  $error,
  $type,
  createClient,
  createRouter,
  toFetchHandler,
} from 'rouzer'
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

function createLocalFetch(
  handler: ReturnType<typeof createRouter>
): typeof fetch {
  const fetchHandler = toFetchHandler(handler)
  return (input, init) => fetchHandler(new Request(input, init))
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

  const found = await client.getUser({ id: '42' })
  const created = await client.getUser({ id: 'created' })
  const missing = await client.getUser({ id: 'missing' })
  const unauthorized = await client.getUser({ id: 'unauthorized' })

  return { found, created, missing, unauthorized }
}
