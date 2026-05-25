import { createTest } from '../shared.js'
import handler from './handler.js'
import * as routes from './routes.js'

export default createTest({
  name: 'parameter coercion',
  routes,
  handler,
  test: async client => {
    let result = await client.coercionRoute({
      id: 123,
      value: 456,
      active: true,
      optionalVal: 789,
    })

    expect(result).toEqual({
      id: 123,
      value: 456,
      active: true,
      optionalVal: 789,
    })
    expect(typeof result.id).toBe('number')
    expect(typeof result.value).toBe('number')
    expect(typeof result.active).toBe('boolean')
    expect(typeof result.optionalVal).toBe('number')

    result = await client.coercionRoute({
      id: 123,
      value: 456,
      active: true,
    })
    expect(result.optionalVal).toBeUndefined()
  },
})
