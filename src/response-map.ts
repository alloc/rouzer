import {
  getResponsePluginMarkerId,
  responsePluginMarker,
} from './response.js'
import { $error } from './type.js'
import type { RouteResponseMap, RouteSchema } from './types/schema.js'

/** Return true when the response schema is a status-keyed response map. */
export function isResponseMap(
  response: RouteSchema['response']
): response is RouteResponseMap {
  return (
    typeof response === 'object' &&
    response !== null &&
    !(responsePluginMarker in response)
  )
}

/** Return true when the marker represents a declared error response. */
export function isErrorMarker(marker: unknown): boolean {
  return marker === $error.symbol
}

/** Return true when the marker represents a success response. */
export function isSuccessMarker(marker: unknown): boolean {
  return marker !== undefined && !isErrorMarker(marker)
}

/** Find the default success status for a direct handler result. */
export function getResponseMapPluginIds(responseMap: RouteResponseMap): string[] {
  return Object.values(responseMap).flatMap(marker => {
    const pluginId = getResponsePluginMarkerId(marker)
    return pluginId ? [pluginId] : []
  })
}

export function getDefaultSuccessStatus(responseMap: RouteResponseMap): number {
  for (const key of Object.keys(responseMap)) {
    const marker = responseMap[Number(key)]
    if (isSuccessMarker(marker)) {
      return Number(key)
    }
  }
  return 200
}
