import { createTest } from '../shared.js'
import handler from './handler.js'
import { routes } from './routes.js'

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []
  for await (const value of source) {
    values.push(value)
  }
  return values
}

export default createTest({
  name: 'NDJSON response streams are typed and parsed',
  routes,
  handler,
  test: async client => {
    await expect(collect(await client.events())).resolves.toEqual([
      { id: 1, message: 'ready' },
      { id: 2, message: 'done' },
    ])

    await expect(
      collect(await client.ndjson(routes.events.request()))
    ).resolves.toEqual([
      { id: 1, message: 'ready' },
      { id: 2, message: 'done' },
    ])

    const response = await client.request(routes.events.request())
    expect(response.headers.get('content-type')).toBe(
      'application/x-ndjson; charset=utf-8'
    )
    await expect(response.text()).resolves.toBe(
      '{"id":1,"message":"ready"}\n{"id":2,"message":"done"}\n'
    )

    await expect(client.fails()).rejects.toThrow(
      'Request to GET /fails failed with status 418'
    )
    await expect(client.fails()).rejects.toMatchObject({ code: 'nope' })
  },
})
