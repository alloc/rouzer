import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import * as z from 'zod'
import { expectTypeOf, test } from 'vitest'

const User = z.object({ id: z.string() })
const Problem = z.object({ code: z.literal('NOT_FOUND') })

const routes = {
  getUser: http.get('users/:id', {
    response: { 200: User, 404: Problem, 422: Problem },
  }),
  listUsers: http.get('users', { response: z.array(User) }),
}

const client = createClient({ baseURL: 'https://example.com', routes })

test('Zod schemas infer direct and status-keyed responses', () => {
  expectTypeOf<Awaited<ReturnType<typeof client.getUser>>>().toEqualTypeOf<
    | [null, { id: string }, 200]
    | [{ code: 'NOT_FOUND' }, null, 404]
    | [{ code: 'NOT_FOUND' }, null, 422]
  >()
  expectTypeOf<Awaited<ReturnType<typeof client.listUsers>>>().toEqualTypeOf<
    { id: string }[]
  >()

  createRouter().use(routes, {
    getUser(ctx) {
      if (ctx.path.id === 'missing') {
        return ctx.error(404, { code: 'NOT_FOUND' })
      }
      return { id: ctx.path.id }
    },
    listUsers() {
      return [{ id: '1' }]
    },
  })
})
