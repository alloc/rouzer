import { describe, expect, test } from 'vitest'
import * as z from 'zod'
import { $type, metadata } from 'rouzer'
import * as http from 'rouzer/http'
import { generateOpenAPI } from '../src/openapi.js'

const User = z.object({ id: z.string(), name: z.string() })
const NotFound = z.object({ code: z.literal('NOT_FOUND') })

describe('generateOpenAPI', () => {
  test('exports request and status-keyed response schemas', () => {
    const routes = {
      users: http.resource('users/:id', {
        get: http.get({
          ...metadata({ summary: 'Get a user' }),
          path: z.object({ id: z.uuid() }),
          query: z.object({ includePosts: z.boolean().optional() }),
          response: { 200: User, 404: NotFound },
        }),
      }),
    }

    const document = generateOpenAPI(routes, {
      info: { title: 'Users', version: '1.0.0' },
    })

    expect(document.openapi).toBe('3.1.0')
    expect(document.paths['/users/{id}'].get).toMatchObject({
      operationId: 'users.get',
      summary: 'Get a user',
      parameters: [
        { name: 'id', in: 'path', required: true },
        { name: 'includePosts', in: 'query', required: false },
      ],
      responses: {
        200: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        404: { description: 'Error response' },
      },
    })
  })

  test('rejects contracts that only have TypeScript response types', () => {
    const routes = {
      get: http.get('users', { response: $type<{ id: string }>() }),
    }
    expect(() =>
      generateOpenAPI(routes, { info: { title: 'Users', version: '1' } })
    ).toThrow('type-only and plugin response markers cannot be exported')
  })
})
