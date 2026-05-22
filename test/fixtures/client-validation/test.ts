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

    await expect(queryClient.queryRoute({ query: { q: 'x' } })).rejects
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

    await expect(bodyClient.bodyRoute({ body: { count: -1 } })).rejects
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

    const headerClient = createClient({
      baseURL: 'http://test.local',
      routes,
      headers: { 'x-token': 'abc' },
      fetch,
    })

    await expect(
      headerClient.headerRoute({ credentials: 'include' })
    ).resolves.toBeInstanceOf(Response)
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://test.local/headers'),
      expect.objectContaining({
        credentials: 'include',
        headers: { 'x-token': 'abc' },
      })
    )
  },
}
