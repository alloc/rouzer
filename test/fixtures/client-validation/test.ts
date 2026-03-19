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
      [ZodError: [
        {
          "origin": "string",
          "code": "too_small",
          "minimum": 2,
          "inclusive": true,
          "path": [
            "q"
          ],
          "message": "Too small: expected string to have >=2 characters"
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
      [ZodError: [
        {
          "origin": "number",
          "code": "too_small",
          "minimum": 0,
          "inclusive": false,
          "path": [
            "count"
          ],
          "message": "Too small: expected number to be >0"
        }
      ]]
    `)
    expect(fetch).not.toHaveBeenCalled()
  },
}
