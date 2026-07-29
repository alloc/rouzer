import { createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'
import { assertType, test } from 'vitest'
import * as z from 'zod'

const routes = {
  catalog: http.get('catalog', {
    query: z.object({
      keys: z
        .string()
        .trim()
        .min(1)
        .transform(value => value.split(','))
        .pipe(z.array(z.string().min(1)).min(1)),
    }),
  }),
}

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

test('client query input uses the pre-transform schema type', () => {
  assertType<Promise<Response>>(client.catalog({ keys: 'one,two' }))

  // @ts-expect-error Generated clients accept schema input, not parsed output.
  client.catalog({ keys: ['one', 'two'] })
})

test('query handlers use the transformed schema output type', () => {
  createRouter().use(routes, {
    catalog(ctx) {
      assertType<string[]>(ctx.query.keys)
      return new Response(null)
    },
  })
})
