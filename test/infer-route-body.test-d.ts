import * as z from 'zod'
import type { InferRouteBody, InferRouteMethodBody } from 'rouzer'
import { route } from 'rouzer'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

type Assert<T extends true> = T

const createUserRoute = route('users', {
  POST: {
    body: z.object({
      name: z.string(),
    }),
  },
})

type _BodyFromFactory = Assert<
  Equal<InferRouteBody<typeof createUserRoute.POST>, { name: string }>
>

type _BodyFromMethodContract = Assert<
  Equal<InferRouteMethodBody<typeof createUserRoute, 'POST'>, { name: string }>
>

const looseMutationRoute = route('users/loose', {
  POST: {},
})

type _UnknownWhenBodySchemaMissing = Assert<
  Equal<InferRouteBody<typeof looseMutationRoute.POST>, unknown>
>

const getUserRoute = route('users/:id', {
  GET: {},
})

type _UnknownForStandaloneGetMethod = Assert<
  Equal<InferRouteBody<typeof getUserRoute.GET>, unknown>
>

type _NeverForGetMethodContract = Assert<
  Equal<InferRouteMethodBody<typeof getUserRoute, 'GET'>, never>
>
