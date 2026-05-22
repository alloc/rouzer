import { createTest } from '../shared.js'
import handler from './handler.js'
import * as routes from './routes.js'

export default createTest({
  name: 'response typing (json vs response)',
  routes,
  handler,
  test: async client => {
    const jsonResult = await client.jsonRoute()
    expect(jsonResult).toEqual({ message: 'ok' })

    const response = await client.pingRoute()
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('pong')
  },
})
