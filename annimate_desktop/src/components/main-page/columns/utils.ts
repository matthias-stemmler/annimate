import {
  AnnoKey,
  AnnoKeyOrQueryNodePropertyKey,
  EdgeType,
  QueryNodePropertyKey,
} from '@/lib/api-types';

const TAG_ANNO_KEY = 'anno-key';
const TAG_QUERY_NODE_PROPERTY_KEY = 'query-node-property-key';
const TAG_EDGE_TYPE = 'edge-type';
const TAG_SEGMENTATION = 'segmentation';
const TAG_DEFAULT = 'default';

export const annoKeyToValue = (annoKey: AnnoKey): string =>
  toTaggedValue(TAG_ANNO_KEY, { ns: annoKey.ns, name: annoKey.name });

export const valueToAnnoKey = (value: string): AnnoKey =>
  fromTaggedValueWithTag(TAG_ANNO_KEY, value);

export const annoKeyOrDefaultToValue = (
  annoKeyOrDefault: AnnoKey | 'default',
): string =>
  annoKeyOrDefault === 'default'
    ? toTaggedValue(TAG_DEFAULT, null)
    : annoKeyToValue(annoKeyOrDefault);

export const valueToAnnoKeyOrDefault = (value: string): AnnoKey | 'default' => {
  const { tag, payload } = fromTaggedValue(value);

  if (tag === TAG_DEFAULT) {
    return 'default';
  }

  if (tag === TAG_ANNO_KEY) {
    return payload as AnnoKey;
  }

  throw new Error(`Unexpected tag in tagged value: ${value}`);
};

export const annoKeyOrQueryNodePropertyKeyToValue = ({
  type,
  key,
}: AnnoKeyOrQueryNodePropertyKey): string =>
  type === 'anno_key'
    ? annoKeyToValue(key)
    : toTaggedValue(TAG_QUERY_NODE_PROPERTY_KEY, key);

export const valueToAnnoKeyOrQueryNodePropertyKey = (
  value: string,
): AnnoKeyOrQueryNodePropertyKey => {
  const { tag, payload } = fromTaggedValue(value);

  if (tag === TAG_ANNO_KEY) {
    return { type: 'anno_key', key: payload as AnnoKey };
  }

  if (tag === TAG_QUERY_NODE_PROPERTY_KEY) {
    return {
      type: 'query_node_property_key',
      key: payload as QueryNodePropertyKey,
    };
  }

  throw new Error(`Unexpected tag in tagged value: ${value}`);
};

export const edgeTypeToValue = (edgeType: EdgeType): string =>
  toTaggedValue(TAG_EDGE_TYPE, { ctype: edgeType.ctype, name: edgeType.name });

export const valueToEdgeType = (value: string): EdgeType =>
  fromTaggedValueWithTag(TAG_EDGE_TYPE, value);

export const segmentationToValue = (segmentation: string): string =>
  toTaggedValue(TAG_SEGMENTATION, segmentation);

export const valueToSegmentation = (value: string): string =>
  fromTaggedValueWithTag(TAG_SEGMENTATION, value);

const toTaggedValue = (tag: string, payload: unknown): string =>
  `${tag}:${JSON.stringify(payload)}`;

const fromTaggedValue = (value: string): { tag: string; payload: unknown } => {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) {
    throw new Error(`Invalid tagged value: ${value}`);
  }

  return {
    tag: value.slice(0, separatorIndex),
    payload: JSON.parse(value.slice(separatorIndex + 1)),
  };
};

const fromTaggedValueWithTag = <T>(expectedTag: string, value: string): T => {
  const { tag, payload } = fromTaggedValue(value);
  if (tag !== expectedTag) {
    throw new Error(`Expected tag '${expectedTag}' in tagged value: ${value}`);
  }

  return payload as T;
};
