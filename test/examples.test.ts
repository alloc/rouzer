import { runBasicUsageExample } from '../examples/basic-usage.js'
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

test('NDJSON stream example stays runnable', async () => {
  await expect(runNdjsonStreamExample()).resolves.toEqual([
    { id: 1, message: 'ready' },
    { id: 2, message: 'done' },
  ])
})
