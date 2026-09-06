import { describe, expect, test } from 'vitest'
import * as z from 'zod'
import { createClient, createRouter, toFetchHandler } from 'rouzer'
import * as http from 'rouzer/http'

const routes = {
  get: http.get('items/:id', {
    response: {
      200: z.object({ id: z.string() }),
      404: z.object({ code: z.literal('NOT_FOUND') }),
    },
  }),
}

describe('Zod response schemas', () => {
  test('validate server responses and classify statuses', async () => {
    const router = createRouter().use(routes, {
      get(ctx) {
        return ctx.path.id === 'missing'
          ? ctx.error(404, { code: 'NOT_FOUND' })
          : { id: ctx.path.id }
      },
    })

    const fetchHandler = toFetchHandler(router)
    const success = await fetchHandler(
      new Request('https://example.com/items/1')
    )
    expect(success.status).toBe(200)
    expect(await success.json()).toEqual({ id: '1' })

    const missing = await fetchHandler(
      new Request('https://example.com/items/missing')
    )
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ code: 'NOT_FOUND' })
  })

  test('validates parsed client responses', async () => {
    const client = createClient({
      baseURL: 'https://example.com/',
      routes,
      fetch: async () => Response.json({ id: 42 }),
    })
    await expect(client.get({ id: '1' })).rejects.toBeInstanceOf(z.ZodError)
  })
})
