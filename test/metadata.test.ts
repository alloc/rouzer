import { metadata } from 'rouzer'
import * as http from 'rouzer/http'

test('attaches metadata to HTTP actions', () => {
  const action = http.post('sessions/list', {
    ...metadata({
      summary: 'List sessions',
      description: 'Lists daemon-managed sessions and pagination state.',
    }),
  })

  expect(action.metadata).toEqual({
    summary: 'List sessions',
    description: 'Lists daemon-managed sessions and pagination state.',
  })
  expect(Object.getOwnPropertySymbols(action.schema)).toHaveLength(0)
})

test('attaches metadata to HTTP resources', () => {
  const resource = http.resource('session', {
    ...metadata({
      description: 'Daemon-managed session control.',
    }),
    list: http.post('list', {
      ...metadata({
        description: 'Lists daemon-managed sessions.',
      }),
    }),
  })

  expect(resource.metadata).toEqual({
    description: 'Daemon-managed session control.',
  })
  expect(Object.getOwnPropertySymbols(resource.children)).toHaveLength(0)
  expect(resource.children.list.metadata).toEqual({
    description: 'Lists daemon-managed sessions.',
  })
})
