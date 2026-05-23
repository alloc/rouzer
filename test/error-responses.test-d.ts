import { $type, $error, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

type Assert<T extends true> = T

// --- Route with response map ---

type User = { id: string; name: string }
type NotFoundError = { code: 'NOT_FOUND'; message: string }
type AuthError = { code: 'UNAUTHORIZED'; message: string }

const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    401: $error<AuthError>(),
    404: $error<NotFoundError>(),
  },
})

const routes = { getUser }

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

// Client action returns a discriminated tuple
type GetUserResult = Awaited<ReturnType<typeof client.getUser>>

type _ClientReturnsDiscriminatedTuple = Assert<
  Equal<
    GetUserResult,
    [null, User, 200] | [AuthError, null, 401] | [NotFoundError, null, 404]
  >
>

// Handler can return success value or ctx.error(...)
createRouter().use(routes, {
  getUser(ctx) {
    if (ctx.path.id === 'missing') {
      return ctx.error(404, { code: 'NOT_FOUND', message: 'not found' })
    }
    if (ctx.path.id === 'unauthorized') {
      return ctx.error(401, { code: 'UNAUTHORIZED', message: 'no auth' })
    }
    return { id: ctx.path.id, name: 'Ada' }
  },
})

// --- Verify existing $type<T>() still works ---

const simpleRoute = http.get('simple', {
  response: $type<{ message: string }>(),
})

const simpleRoutes = { simpleRoute }
const simpleClient = createClient({
  baseURL: 'https://example.com/api/',
  routes: simpleRoutes,
})

type SimpleResult = Awaited<ReturnType<typeof simpleClient.simpleRoute>>

type _SimpleRouteStillReturnsPlainType = Assert<
  Equal<SimpleResult, { message: string }>
>
