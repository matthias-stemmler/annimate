/**
 * Collection utility functions for common data transformation patterns.
 *
 * These functions provide generic, type-safe operations for working
 * with arrays and collections, following functional programming
 * principles — no mutation, no side effects, always returning new values.
 */

/**
 * Finds the first eligible value from a list that matches a given
 * reference value using a custom comparator. Returns `undefined`
 * if the reference value itself is `undefined` or if no match is found.
 *
 * This is commonly used to reconcile server-provided "eligible" options
 * with a currently selected value that may have become stale — for
 * example, when the available annotation keys change after switching
 * corpora, the previously selected key may no longer be valid.
 *
 * @param eligibleValues - The list of currently valid values
 * @param value - The value to match against (undefined = no match)
 * @param compare - Comparison function returning true when values match
 * @returns The matching eligible value, or undefined
 */
export const filterEligible = <S, T>(
  eligibleValues: S[] | undefined,
  value: T | undefined,
  compare: (a: S, b: T) => boolean,
): S | undefined =>
  value === undefined
    ? undefined
    : eligibleValues?.find((v) => compare(v, value));

/**
 * Groups items by a key extractor function, returning an ordered array
 * of [key, items[]] pairs. Items are grouped in the order they appear,
 * and groups maintain insertion order via Map.
 *
 * Unlike Object.groupBy (which returns a plain object), this preserves
 * key types (including non-string keys) and maintains a stable ordering.
 *
 * @param items - The readonly array of items to group
 * @param getKey - Function that extracts the grouping key from each item
 * @returns Array of [key, group members] tuples
 */
export const groupBy = <K, T>(
  items: readonly T[],
  getKey: (x: T) => K,
): [K, T[]][] => {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const members = groups.get(key);
    if (members === undefined) {
      groups.set(key, [item]);
    } else {
      members.push(item);
    }
  }

  return [...groups];
};

/**
 * Returns a new array containing only the unique items from the input,
 * preserving the order of first occurrence.
 *
 * Uses Set for deduplication, which means comparison is by reference
 * equality (SameValueZero) — the same semantics as `Array.includes`.
 *
 * @param items - The readonly array to deduplicate
 * @returns A new array with duplicates removed
 */
export const uniq = <T>(items: readonly T[]): T[] => [...new Set(items)];
