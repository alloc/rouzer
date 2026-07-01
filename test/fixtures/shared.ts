import {
  createClient,
  toFetchHandler,
  type ClientResponsePlugin,
  type RequestHandler,
  type RouzerClient,
} from 'rouzer'
import type { HttpRouteTree } from 'rouzer/http'

type CreateTestConfig<TRoutes extends HttpRouteTree> = {
  name: string
  routes: TRoutes
  handler: RequestHandler
  baseURL?: string
  clientPlugins?: readonly ClientResponsePlugin[]
  test: (client: RouzerClient<TRoutes>) => void | Promise<void>
}

function createLocalFetch(handler: RequestHandler): typeof fetch {
  const fetchHandler = toFetchHandler(handler)
  return (input, init) => fetchHandler(new Request(input, init))
}

export type TestFixture = {
  name: string
  run: () => Promise<void>
}

export function createTest<TRoutes extends HttpRouteTree>({
  name,
  routes,
  handler,
  baseURL = 'http://test.local',
  clientPlugins,
  test,
}: CreateTestConfig<TRoutes>): TestFixture {
  return {
    name,
    async run() {
      const client = createClient({
        baseURL,
        routes,
        plugins: clientPlugins,
        fetch: createLocalFetch(handler),
      })

      await test(client)
    },
  }
}
