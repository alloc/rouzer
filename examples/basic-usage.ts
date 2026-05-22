import type { HattipHandler } from '@hattip/core'
import * as z from 'zod'
import { $type, chain, createClient, createRouter } from 'rouzer'
import * as http from 'rouzer/http'

type Profile = {
  id: string
  name: string
  includePosts: boolean
  requestId: string
}

export const profiles = http.resource('profiles/:id', {
  get: http.get({
    query: z.object({
      includePosts: z.optional(z.boolean()),
    }),
    response: $type<Profile>(),
  }),
  update: http.patch({
    body: z.object({
      name: z.string().check(z.minLength(1)),
    }),
    headers: z.object({
      'content-type': z.literal('application/json'),
    }),
    response: $type<Profile>(),
  }),
})

export const routes = { profiles }

/**
 * Tiny Hattip adapter used only to keep this example self-contained. Real apps
 * mount the handler with a Hattip adapter for their runtime.
 */
function createLocalFetch(handler: HattipHandler): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)
    const response = await handler({
      request,
      ip: '127.0.0.1',
      platform: undefined,
      env() {
        return undefined
      },
      passThrough() {},
      waitUntil(promise) {
        void promise
      },
    })

    return response ?? new Response(null, { status: 404 })
  }
}

export async function runBasicUsageExample() {
  const profileMap = new Map([['42', { id: '42', name: 'Ada' }]])

  const requestMiddleware = chain().use(ctx => ({
    requestId: ctx.request.headers.get('x-request-id') ?? 'local',
  }))

  const handler = createRouter({ basePath: 'api/' })
    .use(requestMiddleware)
    .use(routes, {
      profiles: {
        get(ctx) {
          const profile = profileMap.get(ctx.path.id)
          if (!profile) {
            return new Response('Profile not found', { status: 404 })
          }
          return {
            ...profile,
            includePosts: ctx.query.includePosts ?? false,
            requestId: ctx.requestId,
          }
        },
        update(ctx) {
          const current = profileMap.get(ctx.path.id)
          if (!current) {
            return new Response('Profile not found', { status: 404 })
          }
          const profile = { ...current, name: ctx.body.name }
          profileMap.set(ctx.path.id, profile)
          return {
            ...profile,
            includePosts: false,
            requestId: ctx.requestId,
          }
        },
      },
    })

  const client = createClient({
    baseURL: 'https://example.test/api/',
    routes,
    headers: {
      'content-type': 'application/json',
    },
    fetch: createLocalFetch(handler),
  })

  const fetched = await client.profiles.get({
    path: { id: '42' },
    query: { includePosts: false },
    headers: { 'x-request-id': 'docs' },
  })

  const updated = await client.profiles.update({
    path: { id: '42' },
    body: { name: 'Grace' },
  })

  return { fetched, updated }
}
