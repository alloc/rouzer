import { runBasicUsageExample } from '../examples/basic-usage.js'

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
