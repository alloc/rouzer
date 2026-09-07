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
      languages: ['Rust', 'TypeScript'],
      levels: [1, 2],
      flags: [true, false],
    })

    expect(result).toEqual({
      id: 123,
      value: 456,
      active: true,
      optionalVal: 789,
      languages: ['Rust', 'TypeScript'],
      levels: [1, 2],
      flags: [true, false],
    })
    expect(typeof result.id).toBe('number')
    expect(typeof result.value).toBe('number')
    expect(typeof result.active).toBe('boolean')
    expect(typeof result.optionalVal).toBe('number')
    expect(result.languages).toEqual(['Rust', 'TypeScript'])
    expect(result.levels).toEqual([1, 2])
    expect(result.flags).toEqual([true, false])
    expect(result.levels.every(level => typeof level === 'number')).toBe(true)
    expect(result.flags.every(flag => typeof flag === 'boolean')).toBe(true)

    result = await client.coercionRoute({
      id: 123,
      value: 456,
      active: true,
      languages: ['Rust'],
      levels: [1],
    })
    expect(result.optionalVal).toBeUndefined()
    expect(result.languages).toEqual(['Rust'])
    expect(result.levels).toEqual([1])
    expect(result.flags).toBeUndefined()
  },
})
