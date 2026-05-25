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

    await expect(queryClient.queryRoute({ q: 'x' })).rejects
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
    expect(queryClient.clientConfig.routes).toBe(routes)
    await expect(queryClient.config()).resolves.toBeInstanceOf(Response)
    fetch.mockClear()

    const bodyClient = createClient({
      baseURL: 'http://test.local',
      routes,
      fetch,
    })

    await expect(bodyClient.bodyRoute({ count: -1 })).rejects
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

    const bytes = new Uint8Array([1, 2, 3])
    await bodyClient.rawBodyRoute({ id: 'avatar' }, { body: bytes })
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://test.local/raw/avatar'),
      expect.objectContaining({
        body: bytes,
      })
    )
    fetch.mockClear()

    const headerClient = createClient({
      baseURL: 'http://test.local',
      routes,
      headers: { 'x-token': 'abc' },
      fetch,
    })

    await expect(
      headerClient.headerRoute(undefined, { credentials: 'include' })
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
