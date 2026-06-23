import * as z from 'zod'
import type { InferRouteBody } from 'rouzer'
import * as http from 'rouzer/http'
import { expectTypeOf, test } from 'vitest'

const createUser = http.post('users', {
  body: z.object({
    name: z.string(),
  }),
})

const looseMutation = http.post('users/loose', {})

const getUser = http.get('users/:id', {})

test('infers route bodies from action schemas', () => {
  expectTypeOf<InferRouteBody<typeof createUser.schema>>().toEqualTypeOf<{
    name: string
  }>()
  expectTypeOf<
    InferRouteBody<typeof looseMutation.schema>
  >().toEqualTypeOf<unknown>()
  expectTypeOf<InferRouteBody<typeof getUser.schema>>().toEqualTypeOf<unknown>()
})
