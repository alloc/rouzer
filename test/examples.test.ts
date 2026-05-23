import { runBasicUsageExample } from '../examples/basic-usage.js'
import { runErrorResponsesExample } from '../examples/error-responses.js'
import { runNdjsonStreamExample } from '../examples/ndjson-stream.js'

test('basic usage example stays runnable', async () => {
  await expect(runBasicUsageExample()).resolves.toEqual({
    fetched: {
      id: '42',
      name: 'Ada',
      includePosts: false,
      requestId: 'docs',
    },
    updated: {
      id: '42',
      name: 'Grace',
      includePosts: false,
      requestId: 'local',
    },
  })
})

test('typed error response example stays runnable', async () => {
  await expect(runErrorResponsesExample()).resolves.toEqual({
    found: [null, { id: '42', name: 'Ada' }, 200],
    created: [null, { id: 'created', name: 'Grace' }, 201],
    missing: [{ code: 'NOT_FOUND', message: 'User not found' }, null, 404],
    unauthorized: [
      { code: 'UNAUTHORIZED', message: 'Login required' },
      null,
      401,
    ],
  })
})

test('NDJSON stream example stays runnable', async () => {
  await expect(runNdjsonStreamExample()).resolves.toEqual([
    { id: 1, message: 'ready' },
    { id: 2, message: 'done' },
  ])
})
