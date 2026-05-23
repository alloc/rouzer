import * as ndjson from 'rouzer/ndjson'
import { createTest } from '../shared.js'
import handler from './handler.js'
import * as routes from './routes.js'

export default createTest({
  name: 'typed error responses ($error<T> with status-keyed response map)',
  routes,
  handler,
  test: async client => {
    // Success case: returns tuple [null, User, 200]
    const [error1, result1, status1] = await client.getUser({
      path: { id: '42' },
    })
    expect(error1).toBeNull()
    expect(result1).toEqual({ id: '42', name: 'Ada' })
    expect(status1).toBe(200)

    // Explicit success case: returns tuple [null, User, 201]
    const [error4, result4, status4] = await client.getUser({
      path: { id: 'created' },
    })
    expect(error4).toBeNull()
    expect(result4).toEqual({ id: 'created', name: 'Grace' })
    expect(status4).toBe(201)

    // Plugin success case inside a response map.
    const [streamError, stream, streamStatus] = await client.streamUsers()
    expect(streamError).toBeNull()
    expect(streamStatus).toBe(200)
    const users = []
    for await (const user of stream!) {
      users.push(user)
    }
    expect(users).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' },
    ])

    // 401 error case: returns tuple [AuthError, null, 401]
    const [error2, result2, status2] = await client.getUser({
      path: { id: 'unauthorized' },
    })
    expect(error2).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Login required',
    })
    expect(result2).toBeNull()
    expect(status2).toBe(401)

    // 404 error case: returns tuple [NotFoundError, null, 404]
    const [error3, result3, status3] = await client.getUser({
      path: { id: 'missing' },
    })
    expect(error3).toEqual({
      code: 'NOT_FOUND',
      message: 'User not found',
    })
    expect(result3).toBeNull()
    expect(status3).toBe(404)
  },
})
