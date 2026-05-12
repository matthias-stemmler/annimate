import { AnnoKey, EdgeType } from '@/lib/api-types';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  JSON.stringify({ ns: annoKey.ns, name: annoKey.name });

export const valueToAnnoKey = (value: string): AnnoKey => JSON.parse(value);

export const edgeTypeToValue = (edgeType: EdgeType): string =>
  JSON.stringify({ ctype: edgeType.ctype, name: edgeType.name });

export const valueToEdgeType = (value: string): EdgeType => JSON.parse(value);
