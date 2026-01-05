import { createTestClient } from '@hattip/adapter-test'
import type { HattipHandler } from '@hattip/core'
import type { Route } from 'rouzer'
import { createClient, type RouzerClient } from 'rouzer'

type CreateTestConfig<TRoutes extends Record<string, Route>, P = unknown> = {
  name: string
  routes: TRoutes
  handler: HattipHandler<P>
  baseURL?: string
  test: (client: RouzerClient<TRoutes>) => void | Promise<void>
}

export type TestFixture = {
  name: string
  run: () => Promise<void>
}

export function createTest<TRoutes extends Record<string, Route>, P = unknown>({
  name,
  routes,
  handler,
  baseURL = 'http://test.local',
  test,
}: CreateTestConfig<TRoutes, P>): TestFixture {
  return {
    name,
    async run() {
      const client = createClient({
        baseURL,
        routes,
        fetch: createTestClient({
          handler,
          baseUrl: baseURL,
        }),
      })

      await test(client)
    },
  }
}
