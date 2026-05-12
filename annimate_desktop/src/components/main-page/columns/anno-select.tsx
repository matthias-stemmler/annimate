import {
  annoKeyToValue,
  valueToAnnoKey,
} from '@/components/main-page/columns/utils';
import { Select } from '@/components/ui/custom/select';
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
  const {
    data: exportableNodeAnnoKeys,
    error,
    isPending,
  } = useExportableNodeAnnoKeys();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error.message}`);
  }

  return (
    <AnnoSelect
      annoKey={annoKey}
      disabled={disabled}
      exportableAnnoKeys={exportableNodeAnnoKeys?.[category] ?? []}
      id={id}
      isPending={isPending}
      onChange={onChange}
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
  const {
    data: exportableEdgeTypes,
    error,
    isPending,
  } = useExportableEdgeTypes();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable edge types: ${error.message}`);
  }

  return (
    <AnnoSelect
      annoKey={annoKey}
      disabled={disabled}
      exportableAnnoKeys={
        edgeType === undefined
          ? []
          : (exportableEdgeTypes?.find(
              (e) =>
                e.edgeType.ctype === edgeType.ctype &&
                e.edgeType.name === edgeType.name,
            )?.annoKeys ?? [])
      }
      id={id}
      isPending={isPending}
      onChange={onChange}
    />
  );
};

type AnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  disabled: boolean;
  exportableAnnoKeys: ExportableAnnoKey[];
  id?: string;
  isPending: boolean;
  onChange?: (annoKey: AnnoKey) => void;
};

const AnnoSelect: FC<AnnoSelectProps> = ({
  annoKey,
  disabled,
  exportableAnnoKeys,
  id,
  isPending,
  onChange,
}) => {
  return (
    <Select
      className="h-8"
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(value) => onChange?.(valueToAnnoKey(value))}
      options={[
        {
          groupKey: 'other',
          groupItems: exportableAnnoKeys
            .filter((e) => e.annoKey.ns !== 'annis')
            .map(({ displayName, annoKey }) => ({
              caption: <span className="font-mono">{displayName}</span>,
              value: annoKeyToValue(annoKey),
            })),
        },
        {
          groupKey: 'annis',
          groupCaption: 'ANNIS',
          groupItems: exportableAnnoKeys
            .filter((e) => e.annoKey.ns === 'annis')
            .map(({ displayName, annoKey }) => ({
              caption: <span className="font-mono">{displayName}</span>,
              value: annoKeyToValue(annoKey),
            })),
        },
      ]}
      value={annoKey === undefined ? undefined : annoKeyToValue(annoKey)}
    />
  );
};
