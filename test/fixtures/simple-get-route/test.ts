import { createTest } from '../shared.js'
import handler from './handler.js'
import * as routes from './routes.js'

export default createTest({
  name: 'simple GET route',
  routes,
  handler,
  test: async client => {
    const result = await client.helloRoute.GET({
      path: { name: 'world' },
    })

    expect(result).toEqual({ message: 'Hello, world!' })
  },
})
