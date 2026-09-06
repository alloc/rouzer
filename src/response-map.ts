import { getResponsePluginMarkerId, responsePluginMarker } from './response.js'
import { $error } from './type.js'
import type { RouteResponseMap } from './types/schema.js'
import * as z from 'zod'

/** Return true when the response schema is a status-keyed response map. */
export function isResponseMap(response: unknown): response is RouteResponseMap {
  return (
    typeof response === 'object' &&
    response !== null &&
    !isZodResponseSchema(response) &&
    !(responsePluginMarker in response)
  )
}

/** Return true when the marker represents a declared error response. */
export function isZodResponseSchema(marker: unknown): marker is z.ZodType {
  return marker instanceof z.ZodType
}

/** Return true when a response-map entry represents an error response. */
export function isErrorResponse(status: number, marker: unknown): boolean {
  return (
    marker === $error.symbol || (isZodResponseSchema(marker) && status >= 400)
  )
}

/** Return true when the marker represents a success response. */
export function isSuccessMarker(marker: unknown): boolean {
  return marker !== undefined && marker !== $error.symbol
}

/** Find the default success status for a direct handler result. */
export function getResponseMapPluginIds(
  responseMap: RouteResponseMap
): string[] {
  return Object.values(responseMap).flatMap(marker => {
    const pluginId = getResponsePluginMarkerId(marker)
    return pluginId ? [pluginId] : []
  })
}

export function getDefaultSuccessStatus(responseMap: RouteResponseMap): number {
  for (const key of Object.keys(responseMap)) {
    const marker = responseMap[Number(key)]
    if (isSuccessMarker(marker) && !isErrorResponse(Number(key), marker)) {
      return Number(key)
    }
  }
  return 200
}
