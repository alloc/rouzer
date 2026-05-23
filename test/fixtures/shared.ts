import { createTestClient } from '@hattip/adapter-test'
import type { HattipHandler } from '@hattip/core'
import {
  createClient,
  type ClientResponsePlugin,
  type RouzerClient,
} from 'rouzer'
import type { HttpRouteTree } from 'rouzer/http'

type CreateTestConfig<TRoutes extends HttpRouteTree, P = unknown> = {
  name: string
  routes: TRoutes
  handler: HattipHandler<P>
  baseURL?: string
  clientPlugins?: readonly ClientResponsePlugin[]
  test: (client: RouzerClient<TRoutes>) => void | Promise<void>
}

export type TestFixture = {
  name: string
  run: () => Promise<void>
}

export function createTest<TRoutes extends HttpRouteTree, P = unknown>({
  name,
  routes,
  handler,
  baseURL = 'http://test.local',
  clientPlugins,
  test,
}: CreateTestConfig<TRoutes, P>): TestFixture {
  return {
    name,
    async run() {
      const client = createClient({
        baseURL,
        routes,
        plugins: clientPlugins,
        fetch: createTestClient({
          handler,
          baseUrl: baseURL,
        }),
      })

      await test(client)
    },
  }
}
