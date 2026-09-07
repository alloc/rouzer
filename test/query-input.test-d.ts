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
  search: http.get('search', {
    query: z.object({
      language: z.array(z.string()).min(1),
    }),
  }),
}

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

test('array query fields stay typed across clients and handlers', () => {
  assertType<Promise<Response>>(
    client.search({ language: ['Rust', 'TypeScript'] })
  )

  // @ts-expect-error Array query fields require array client input.
  client.search({ language: 'Rust' })

  createRouter().use(routes, {
    catalog() {
      return new Response(null)
    },
    search(ctx) {
      assertType<string[]>(ctx.query.language)
      return new Response(null)
    },
  })
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
    search() {
      return new Response(null)
    },
  })
})
