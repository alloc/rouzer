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
