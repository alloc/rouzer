import { $type, $error, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import { expectTypeOf, test } from 'vitest'

// --- Route with response map ---

type User = { id: string; name: string }
type NotFoundError = { code: 'NOT_FOUND'; message: string }
type AuthError = { code: 'UNAUTHORIZED'; message: string }

const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    201: $type<User>(),
    401: $error<AuthError>(),
    404: $error<NotFoundError>(),
  },
})

const routes = { getUser }

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

type GetUserResult = Awaited<ReturnType<typeof client.getUser>>

test('response maps produce discriminated client tuples', () => {
  expectTypeOf<GetUserResult>().toEqualTypeOf<
    | [null, User, 200]
    | [null, User, 201]
    | [AuthError, null, 401]
    | [NotFoundError, null, 404]
  >()
})

test('response map handlers can return success values and helpers', () => {
  createRouter().use(routes, {
    getUser(ctx) {
      if (ctx.path.id === 'missing') {
        return ctx.error(404, { code: 'NOT_FOUND', message: 'not found' })
      }
      if (ctx.path.id === 'unauthorized') {
        return ctx.error(401, { code: 'UNAUTHORIZED', message: 'no auth' })
      }
      if (ctx.path.id === 'created') {
        return ctx.success(201, { id: ctx.path.id, name: 'Ada' })
      }
      return { id: ctx.path.id, name: 'Ada' }
    },
  })
})

test('response map helpers reject undeclared statuses and mismatched bodies', () => {
  createRouter().use(routes, {
    getUser(ctx) {
      // @ts-expect-error 500 is not a declared error status.
      ctx.error(500, { code: 'NOT_FOUND', message: 'nope' })
      // @ts-expect-error Error body must match the selected status.
      ctx.error(404, { code: 'UNAUTHORIZED', message: 'nope' })
      // @ts-expect-error 404 is not a declared success status.
      ctx.success(404, { code: 'NOT_FOUND', message: 'nope' })
      // @ts-expect-error Success body must match the selected status.
      ctx.success(201, { id: 123, name: 'Ada' })
      return { id: ctx.path.id, name: 'Ada' }
    },
  })
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

test('plain response markers still return plain client values', () => {
  expectTypeOf<SimpleResult>().toEqualTypeOf<{ message: string }>()
})
