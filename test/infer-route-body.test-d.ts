import * as z from 'zod'
import type { InferRouteBody } from 'rouzer'
import * as http from 'rouzer/http'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

type Assert<T extends true> = T

const createUser = http.post('users', {
  body: z.object({
    name: z.string(),
  }),
})

type _BodyFromSchema = Assert<
  Equal<InferRouteBody<typeof createUser.schema>, { name: string }>
>

const looseMutation = http.post('users/loose', {})

type _UnknownWhenBodySchemaMissing = Assert<
  Equal<InferRouteBody<typeof looseMutation.schema>, unknown>
>

const getUser = http.get('users/:id', {})

type _UnknownForGetActionSchema = Assert<
  Equal<InferRouteBody<typeof getUser.schema>, unknown>
>
