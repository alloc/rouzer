import * as z from 'zod'
import type { HttpRouteTree } from './http.js'
import { isRawBodySchema } from './http.js'
import { isResponseMap, isZodResponseSchema } from './response-map.js'

export type OpenAPIOptions = {
  info: { title: string; version: string; description?: string }
  basePath?: string
  servers?: Array<{ url: string; description?: string }>
}

/** Generate an OpenAPI 3.1 document from a Rouzer route tree. */
export function generateOpenAPI(
  routes: HttpRouteTree,
  options: OpenAPIOptions
): Record<string, any> {
  const document: Record<string, any> = {
    openapi: '3.1.0',
    info: options.info,
    paths: {},
  }
  if (options.servers) document.servers = options.servers
  visitRoutes(routes, options.basePath ?? '', '', document.paths)
  return document
}

function visitRoutes(
  routes: HttpRouteTree,
  prefix: string,
  namePrefix: string,
  paths: Record<string, any>
) {
  for (const [name, node] of Object.entries(routes)) {
    const operationId = namePrefix ? `${namePrefix}.${name}` : name
    if (node.kind === 'resource') {
      visitRoutes(
        node.children,
        joinPaths(prefix, node.path.source),
        operationId,
        paths
      )
      continue
    }

    const routePath = joinPaths(prefix, node.path?.source ?? '')
    const path = toOpenAPIPath(routePath, operationId)
    const operation: Record<string, any> = {
      operationId,
      responses: createResponses(node.schema.response, operationId),
    }
    if (node.metadata?.summary) operation.summary = node.metadata.summary
    if (node.metadata?.description)
      operation.description = node.metadata.description

    const declaredPathParameters = createParameters(
      node.schema.path,
      'path',
      operationId
    )
    const parameters = [
      ...completePathParameters(path, declaredPathParameters, operationId),
      ...createParameters(node.schema.query, 'query', operationId),
      ...createParameters(node.schema.headers, 'header', operationId),
    ]
    if (parameters.length) operation.parameters = parameters

    if (node.schema.body) {
      if (isRawBodySchema(node.schema.body)) {
        throw contractError(
          operationId,
          'raw request bodies cannot be exported'
        )
      }
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: jsonSchema(
              node.schema.body,
              operationId,
              'request body',
              'input'
            ),
          },
        },
      }
    }

    ;(paths[path] ??= {})[node.method.toLowerCase()] = operation
  }
}

function createResponses(response: unknown, operationId: string) {
  if (!response) {
    throw contractError(operationId, 'an explicit response schema is required')
  }
  if (isZodResponseSchema(response)) {
    return { '200': createResponse(response, 200, operationId) }
  }
  if (!isResponseMap(response)) {
    throw contractError(
      operationId,
      'type-only and plugin response markers cannot be exported'
    )
  }
  const entries = Object.entries(response)
  if (!entries.length) throw contractError(operationId, 'response map is empty')
  return Object.fromEntries(
    entries.map(([statusText, schema]) => {
      const status = Number(statusText)
      if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw contractError(
          operationId,
          `invalid response status ${statusText}`
        )
      }
      if (!isZodResponseSchema(schema)) {
        throw contractError(
          operationId,
          `response ${status} does not have a runtime Zod schema`
        )
      }
      return [statusText, createResponse(schema, status, operationId)]
    })
  )
}

function createResponse(
  schema: z.ZodType,
  status: number,
  operationId: string
) {
  const response: Record<string, any> = {
    description: status >= 400 ? 'Error response' : 'Successful response',
  }
  if (schema.type !== 'void' && schema.type !== 'undefined' && status !== 204) {
    response.content = {
      'application/json': {
        schema: jsonSchema(schema, operationId, `response ${status}`, 'output'),
      },
    }
  }
  return response
}

function createParameters(
  schema: z.ZodObject<any> | undefined,
  location: 'path' | 'query' | 'header',
  operationId: string
) {
  if (!schema) return []
  const object = jsonSchema(
    schema,
    operationId,
    `${location} parameters`,
    'input'
  )
  const required = new Set<string>(object.required ?? [])
  return Object.entries(object.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || required.has(name),
    schema: property,
  }))
}

function completePathParameters(
  path: string,
  declared: Array<Record<string, any>>,
  operationId: string
) {
  const names: string[] = []
  const parameterPattern = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = parameterPattern.exec(path))) names.push(match[1])
  const nameSet = new Set(names)
  for (const parameter of declared) {
    if (!nameSet.has(parameter.name)) {
      throw contractError(
        operationId,
        `path schema declares ${parameter.name}, which is not in the route path`
      )
    }
  }
  return names.map(
    name =>
      declared.find(parameter => parameter.name === name) ?? {
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }
  )
}

function jsonSchema(
  schema: z.ZodType,
  operationId: string,
  subject: string,
  io: 'input' | 'output'
) {
  try {
    const result = z.toJSONSchema(schema, {
      io,
      unrepresentable: 'throw',
    }) as any
    delete result.$schema
    return result
  } catch (error) {
    throw contractError(
      operationId,
      `${subject} is not representable as JSON Schema: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

function toOpenAPIPath(path: string, operationId: string) {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(path)) {
    throw contractError(operationId, 'absolute URL patterns are not exportable')
  }
  if (/[()?]/.test(path)) {
    throw contractError(
      operationId,
      `route pattern ${JSON.stringify(path)} is not exportable`
    )
  }
  const converted = path
    .replace(/(^|\/)\*([A-Za-z_$][\w$]*)/g, '$1{$2}')
    .replace(/:([A-Za-z_$][\w$]*)/g, '{$1}')
  return `/${converted.replace(/^\/+|\/+$/g, '')}`
}

function joinPaths(left: string, right: string) {
  return [left, right].filter(Boolean).join('/').replace(/\/+/g, '/')
}

function contractError(operationId: string, message: string) {
  return new Error(`Cannot generate OpenAPI for ${operationId}: ${message}`)
}
