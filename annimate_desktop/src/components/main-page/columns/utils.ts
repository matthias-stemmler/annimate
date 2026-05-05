import { AnnoKey, EdgeComponentType, EdgeType } from '@/lib/api-types';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  `${annoKey.ns}:${annoKey.name}`;

// Safe because ANNIS annotation names do not contain colons, and `value` is
// produced by `annoKeyToValue` joining `ns` and `name` with a single `:`.
export const valueToAnnoKey = (value: string): AnnoKey => {
  const [ns, name] = value.split(':', 2);
  return { ns, name };
};

export const edgeTypeToValue = (edgeType: EdgeType): string =>
  `${edgeType.ctype}/${edgeType.name}`;

// Safe because ANNIS component names do not contain slashes, and `value` is
// produced by `edgeTypeToValue` joining `ctype` and `name` with a single `/`.
export const valueToEdgeType = (value: string): EdgeType => {
  const [ctype, name] = value.split('/', 2);
  return { ctype: ctype as EdgeComponentType, name };
};
