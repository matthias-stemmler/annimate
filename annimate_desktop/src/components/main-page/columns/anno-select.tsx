import {
  annoKeyOrDefaultToValue,
  annoKeyToValue,
  valueToAnnoKey,
  valueToAnnoKeyOrDefault,
} from '@/components/main-page/columns/utils';
import { Select, SelectOption } from '@/components/ui/custom/select';
import {
  AnnoKey,
  EdgeType,
  ExportableAnnoKey,
  ExportableNodeAnnoKeyCategory,
} from '@/lib/api-types';
import {
  useExportableEdgeTypes,
  useExportableNodeAnnoKeys,
  useIsExporting,
} from '@/lib/store';
import { FC } from 'react';

type AnnoKeysResult = {
  disabled: boolean;
  exportableAnnoKeys: ExportableAnnoKey[];
  isPending: boolean;
};

const useNodeAnnoKeys = (
  category: ExportableNodeAnnoKeyCategory,
): AnnoKeysResult => {
  const { data, error, isPending } = useExportableNodeAnnoKeys();
  const isExporting = useIsExporting();

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error.message}`);
  }

  return {
    disabled: isExporting,
    exportableAnnoKeys: data?.[category] ?? [],
    isPending,
  };
};

const useEdgeAnnoKeys = (edgeType: EdgeType | undefined): AnnoKeysResult => {
  const { data, error, isPending } = useExportableEdgeTypes();
  const isExporting = useIsExporting();

  if (error !== null) {
    throw new Error(`Failed to load exportable edge types: ${error.message}`);
  }

  return {
    disabled: isExporting,
    exportableAnnoKeys:
      edgeType === undefined
        ? []
        : (data?.find(
            (e) =>
              e.edgeType.ctype === edgeType.ctype &&
              e.edgeType.name === edgeType.name,
          )?.annoKeys ?? []),
    isPending,
  };
};

export type NodeAnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  category: ExportableNodeAnnoKeyCategory;
  id?: string;
  onChange?: (annoKey: AnnoKey) => void;
};

export const NodeAnnoSelect: FC<NodeAnnoSelectProps> = ({
  annoKey,
  category,
  id,
  onChange,
}) => {
  const annoKeysProps = useNodeAnnoKeys(category);

  return (
    <AnnoSelectBase
      fromValue={valueToAnnoKey}
      id={id}
      onChange={onChange}
      toValue={annoKeyToValue}
      value={annoKey}
      {...annoKeysProps}
    />
  );
};

export type EdgeAnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  edgeType: EdgeType | undefined;
  id?: string;
  onChange?: (annoKey: AnnoKey) => void;
};

export const EdgeAnnoSelect: FC<EdgeAnnoSelectProps> = ({
  annoKey,
  edgeType,
  id,
  onChange,
}) => {
  const annoKeysProps = useEdgeAnnoKeys(edgeType);

  return (
    <AnnoSelectBase
      fromValue={valueToAnnoKey}
      id={id}
      onChange={onChange}
      toValue={annoKeyToValue}
      value={annoKey}
      {...annoKeysProps}
    />
  );
};

export type SegmentationAnnoSelectProps = {
  annoKey: AnnoKey | 'default' | undefined;
  id?: string;
  onChange?: (annoKey: AnnoKey | 'default') => void;
  segmentation: string | undefined;
};

export const SegmentationAnnoSelect: FC<SegmentationAnnoSelectProps> = ({
  annoKey,
  id,
  onChange,
  segmentation,
}) => {
  const annoKeysProps = useNodeAnnoKeys('node');

  return (
    <AnnoSelectBase
      fromValue={valueToAnnoKeyOrDefault}
      id={id}
      leadingOptions={
        segmentation === undefined
          ? []
          : [
              {
                caption: <span className="italic">Segmentation text</span>,
                value: annoKeyOrDefaultToValue('default'),
              },
            ]
      }
      onChange={onChange}
      toValue={annoKeyOrDefaultToValue}
      value={annoKey}
      {...annoKeysProps}
    />
  );
};

type AnnoSelectBaseProps<T> = {
  disabled: boolean;
  exportableAnnoKeys: ExportableAnnoKey[];
  fromValue: (value: string) => T;
  id?: string;
  isPending: boolean;
  leadingOptions?: SelectOption<string>[];
  onChange?: (value: T) => void;
  toValue: (value: T | AnnoKey) => string;
  value: T | undefined;
};

const AnnoSelectBase = <T,>({
  disabled,
  exportableAnnoKeys,
  fromValue,
  id,
  isPending,
  leadingOptions = [],
  onChange,
  toValue,
  value,
}: AnnoSelectBaseProps<T>) => {
  return (
    <Select
      className="h-8"
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(v) => onChange?.(fromValue(v))}
      options={[
        {
          groupKey: 'other',
          groupItems: [
            ...leadingOptions,
            ...exportableAnnoKeys
              .filter((e) => e.annoKey.ns !== 'annis')
              .map(({ displayName, annoKey }) => ({
                caption: <span className="font-mono">{displayName}</span>,
                value: toValue(annoKey),
              })),
          ],
        },
        {
          groupKey: 'annis',
          groupCaption: 'ANNIS',
          groupItems: exportableAnnoKeys
            .filter((e) => e.annoKey.ns === 'annis')
            .map(({ displayName, annoKey }) => ({
              caption: <span className="font-mono">{displayName}</span>,
              value: toValue(annoKey),
            })),
        },
      ]}
      value={value === undefined ? undefined : toValue(value)}
    />
  );
};
