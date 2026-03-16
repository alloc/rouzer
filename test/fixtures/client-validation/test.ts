import { createClient } from 'rouzer'
import * as routes from './routes.js'

export default {
  name: 'client validation runs before fetch',
  async run() {
    const fetch = vi.fn(async () => new Response(null))
    const queryClient = createClient({
      baseURL: 'http://test.local',
      routes,
      fetch,
    })

    await expect(queryClient.queryRoute.GET({ query: { q: 'x' } })).rejects
      .toMatchInlineSnapshot(`
      [$ZodError: [
        {
          "origin": "string",
          "code": "too_small",
          "minimum": 2,
          "inclusive": true,
          "path": [
            "q"
          ],
          "message": "Invalid input"
        }
      ]]
    `)

    expect(fetch).not.toHaveBeenCalled()

    const bodyClient = createClient({
      baseURL: 'http://test.local',
      routes,
      fetch,
    })

    await expect(bodyClient.bodyRoute.POST({ body: { count: -1 } })).rejects
      .toMatchInlineSnapshot(`
      [$ZodError: [
        {
          "origin": "number",
          "code": "too_small",
          "minimum": 0,
          "inclusive": false,
          "path": [
            "count"
          ],
          "message": "Invalid input"
        }
      ]]
    `)
    expect(fetch).not.toHaveBeenCalled()
  },
}
