/**
 * Serialization utilities for annotation keys and edge types.
 *
 * These functions convert typed annotation key and edge type objects
 * to/from JSON strings for use in HTML select elements, where values
 * must be plain strings. The round-trip (serialize → deserialize)
 * preserves the original object structure exactly.
 */

import type { AnnoKey, EdgeType } from '@/lib/api-types';

/**
 * Serializes an annotation key to a JSON string for use as a
 * select element value. The resulting string uniquely identifies
 * the annotation key by its namespace and name.
 *
 * @param annoKey - The annotation key to serialize
 * @returns JSON string representation
 */
export const serializeAnnoKey = (annoKey: AnnoKey): string =>
  JSON.stringify({ ns: annoKey.ns, name: annoKey.name });

/**
 * Deserializes a JSON string back to an annotation key object.
 * This is the inverse of `serializeAnnoKey`.
 *
 * @param value - The JSON string to parse
 * @returns The deserialized annotation key
 */
export const deserializeAnnoKey = (value: string): AnnoKey =>
  JSON.parse(value);

/**
 * Serializes an edge type to a JSON string for use as a
 * select element value. The resulting string uniquely identifies
 * the edge type by its component type and name.
 *
 * @param edgeType - The edge type to serialize
 * @returns JSON string representation
 */
export const serializeEdgeType = (edgeType: EdgeType): string =>
  JSON.stringify({ ctype: edgeType.ctype, name: edgeType.name });

/**
 * Deserializes a JSON string back to an edge type object.
 * This is the inverse of `serializeEdgeType`.
 *
 * @param value - The JSON string to parse
 * @returns The deserialized edge type
 */
export const deserializeEdgeType = (value: string): EdgeType =>
  JSON.parse(value);

// Backward-compatible aliases — old names still work but new names
// are preferred for clarity about the serialize/deserialize intent.
export const annoKeyToValue = serializeAnnoKey;
export const valueToAnnoKey = deserializeAnnoKey;
export const edgeTypeToValue = serializeEdgeType;
export const valueToEdgeType = deserializeEdgeType;
