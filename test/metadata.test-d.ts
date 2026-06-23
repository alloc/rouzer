import { createClient, createRouter, metadata } from 'rouzer'
import * as http from 'rouzer/http'
import { assertType, expectTypeOf, test } from 'vitest'
import * as z from 'zod'

const sessions = http.resource('sessions/:sessionId', {
  ...metadata({
    summary: 'Sessions',
    description: 'Daemon-managed session control.',
  }),
  list: http.post('list', {
    ...metadata({
      description: 'Lists daemon-managed sessions and pagination state.',
    }),
    path: z.object({
      sessionId: z.string(),
    }),
    body: z.object({
      cursor: z.optional(z.string()),
    }),
  }),
})

const routes = { sessions }

const client = createClient({
  baseURL: 'https://example.com/api/',
  routes,
})

test('metadata does not change client or handler types', () => {
  expectTypeOf<
    Extract<keyof typeof sessions.children.list.schema, string>
  >().toEqualTypeOf<'path' | 'body'>()

  assertType<Promise<Response>>(
    client.sessions.list({
      sessionId: 'abc',
      cursor: 'next',
    })
  )

  // @ts-expect-error metadata must not become client input.
  assertType(client.sessions.list({ sessionId: 'abc', description: 'ignored' }))
})

test('metadata does not change handler types', () => {
  createRouter().use(routes, {
    sessions: {
      list(ctx) {
        assertType<string>(ctx.path.sessionId)
        assertType<string | undefined>(ctx.body.cursor)
        return new Response(null)
      },
    },
  })
})
