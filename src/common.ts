/**
 * Map over all the keys to create a new object.
 *
 * @see https://radashi.js.org/reference/object/mapEntries
 * @example
 * ```ts
 * const a = { a: 1, b: 2, c: 3 }
 * mapEntries(a, (key, value) => [value, key])
 * // => { 1: 'a', 2: 'b', 3: 'c' }
 * ```
 * @version 12.1.0
 */
export function mapEntries<
  TKey extends string | number | symbol,
  TValue,
  TNewKey extends string | number | symbol,
  TNewValue,
>(
  obj: Record<TKey, TValue>,
  toEntry: (key: TKey, value: TValue) => [TNewKey, TNewValue]
): Record<TNewKey, TNewValue> {
  if (!obj) {
    return {} as Record<TNewKey, TNewValue>
  }
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      const [newKey, newValue] = toEntry(key as TKey, value as TValue)
      acc[newKey] = newValue
      return acc
    },
    {} as Record<TNewKey, TNewValue>
  )
}

/**
 * Removes (shakes out) undefined entries from an object. Optional
 * second argument shakes out values by custom evaluation.
 *
 * Note that non-enumerable keys are never shaken out.
 *
 * @see https://radashi.js.org/reference/object/shake
 * @example
 * ```ts
 * const a = { a: 1, b: undefined, c: 3 }
 * shake(a)
 * // => { a: 1, c: 3 }
 * ```
 * @version 12.1.0
 */
export function shake<T extends object>(
  obj: T
): {
  [K in keyof T]: Exclude<T[K], undefined>
}

export function shake<T extends object>(
  obj: T,
  filter: ((value: unknown) => boolean) | undefined
): T

export function shake<T extends object>(
  obj: T,
  filter: (value: unknown) => boolean = value => value === undefined
): T {
  if (!obj) {
    return {} as T
  }
  return (Object.keys(obj) as (keyof T)[]).reduce((acc, key) => {
    if (!filter(obj[key])) {
      acc[key] = obj[key]
    }
    return acc
  }, {} as T)
}

/**
 * Map over all the keys to create a new object.
 *
 * @see https://radashi.js.org/reference/object/mapValues
 * @example
 * ```ts
 * const a = { a: 1, b: 2, c: 3 }
 * mapValues(a, (value, key) => value * 2)
 * // => { a: 2, b: 4, c: 6 }
 * ```
 * @version 12.1.0
 */
export function mapValues<T extends object, U>(
  obj: T,
  mapFunc: (value: Required<T>[keyof T], key: keyof T) => U
): { [K in keyof T]: U } {
  return (Object.keys(obj) as (keyof T)[]).reduce(
    (acc, key) => {
      acc[key] = mapFunc(obj[key], key)
      return acc
    },
    {} as { [K in keyof T]: U }
  )
}
