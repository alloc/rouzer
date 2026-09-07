import * as z from 'zod'

/** Return whether a schema's input boundary is array-valued. */
export function isArrayInputSchema(schema: z.ZodType): boolean {
  if (schema.type === 'array') {
    return true
  }
  if (schema.type === 'pipe') {
    return isArrayInputSchema((schema as any).def.in)
  }
  if (
    schema.type === 'optional' ||
    schema.type === 'nullable' ||
    schema.type === 'default' ||
    schema.type === 'prefault' ||
    schema.type === 'catch' ||
    schema.type === 'readonly' ||
    schema.type === 'nonoptional'
  ) {
    return isArrayInputSchema((schema as any).def.innerType)
  }
  if (schema.type === 'union') {
    return (schema as any).def.options.every(isArrayInputSchema)
  }
  return false
}

export function createQueryString(
  schema: z.ZodObject,
  query: Record<string, unknown>
) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (isArrayInputSchema(schema.shape[key]) && Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item))
      }
    } else {
      searchParams.append(key, String(value))
    }
  }
  return searchParams.toString()
}

export function parseQueryStringInput(
  schema: z.ZodObject,
  searchParams: URLSearchParams
) {
  const input: Record<string, string | string[]> =
    Object.fromEntries(searchParams)
  for (const [key, field] of Object.entries(schema.shape)) {
    if (searchParams.has(key) && isArrayInputSchema(field)) {
      input[key] = searchParams.getAll(key)
    }
  }
  return input
}
