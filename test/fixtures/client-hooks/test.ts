import { createClient, type RouzerClientHookEvent } from 'rouzer'
import * as ndjson from 'rouzer/ndjson'
import { routes } from './routes.js'

async function collect<T>(source: AsyncIterable<T>) {
  const values: T[] = []
  for await (const value of source) {
    values.push(value)
  }
  return values
}

export default {
  name: 'client lifecycle hooks observe generated action calls',
  async run() {
    const events: RouzerClientHookEvent[] = []
    const fetch = vi.fn(async () =>
      Response.json(
        { id: 'session-1' },
        {
          status: 201,
        }
      )
    )
    const client = createClient({
      baseURL: 'http://test.local',
      routes,
      plugins: [ndjson.clientPlugin],
      fetch,
      clientHook(event) {
        events.push(event)
      },
    })

    await expect(client.session.create({ name: 'Ada' })).resolves.toEqual({
      id: 'session-1',
    })
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'request.start',
      routeName: 'session.create',
      method: 'POST',
      pathPattern: '/session/create',
      payload: { name: 'Ada' },
    })
    expect(events[1]).toMatchObject({
      type: 'request.success',
      opId: events[0].opId,
      routeName: 'session.create',
      response: { id: 'session-1' },
      status: 201,
    })
    expect(events[1].durationMs).toEqual(expect.any(Number))

    events.length = 0
    fetch.mockClear()
    await expect(client.session.create({ name: 'x' })).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'request.start',
      routeName: 'session.create',
      payload: { name: 'x' },
    })
    expect(events[1]).toMatchObject({
      type: 'request.error',
      opId: events[0].opId,
      routeName: 'session.create',
    })
    expect(events[1]).not.toHaveProperty('status')

    events.length = 0
    fetch.mockResolvedValueOnce(new Response('{bad json}', { status: 200 }))
    await expect(client.session.create({ name: 'Ada' })).rejects.toThrow()
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'request.error',
      routeName: 'session.create',
      status: 200,
    })

    events.length = 0
    fetch.mockResolvedValueOnce(
      new Response(ndjson.encodeNdjson([{ id: 1 }]), {
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
        },
      })
    )
    const stream = await client.events()
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'request.success',
      routeName: 'events',
      response: stream,
      status: 200,
    })
    await expect(collect(stream)).resolves.toEqual([{ id: 1 }])

    const swallowingClient = createClient({
      baseURL: 'http://test.local',
      routes,
      plugins: [ndjson.clientPlugin],
      fetch: vi.fn(async () => Response.json({ id: 'session-2' })),
      clientHook() {
        throw new Error('hook failed')
      },
    })
    await expect(
      swallowingClient.session.create({ name: 'Ada' })
    ).resolves.toEqual({ id: 'session-2' })
  },
}
