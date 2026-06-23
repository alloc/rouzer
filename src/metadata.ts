const routeMetadataKey: unique symbol = Symbol('rouzer.metadata')

/** Runtime metadata attached to Rouzer route nodes. */
export type RouteMetadata = {
  /** Short label for generated indexes, clients, CLIs, or docs. */
  summary?: string
  /** Human-readable route description for generated tooling. */
  description?: string
}

type RouteMetadataMarker = {
  readonly [routeMetadataKey]: RouteMetadata
}

/** Attach runtime metadata to a route declaration. */
export function metadata(value: RouteMetadata): object {
  return { [routeMetadataKey]: value }
}

export function getRouteMetadata(value: unknown): RouteMetadata | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Partial<RouteMetadataMarker>)[routeMetadataKey]
    : undefined
}

export function stripRouteMetadata<T extends object>(value: T) {
  const { [routeMetadataKey]: _metadata, ...rest } = value as T &
    Partial<RouteMetadataMarker>
  return rest as Omit<T, typeof routeMetadataKey>
}
