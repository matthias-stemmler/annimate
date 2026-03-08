import {
  annoKeyToValue,
  valueToAnnoKey,
} from '@/components/main-page/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { AnnoKey, ExportableAnnoKeyCategory } from '@/lib/api-types';
import { useExportableAnnoKeys, useIsExporting } from '@/lib/store';
import { FC } from 'react';

export type AnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  category: ExportableAnnoKeyCategory;
  id?: string;
  onChange?: (annoKey: AnnoKey) => void;
};

export const AnnoSelect: FC<AnnoSelectProps> = ({
  annoKey,
  category,
  id,
  onChange,
}) => {
  const {
    data: exportableAnnoKeys,
    error,
    isPending,
  } = useExportableAnnoKeys();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error.message}`);
  }

  const exportableAnnoKeysForCategory = exportableAnnoKeys?.[category] ?? [];

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
          groupItems: exportableAnnoKeysForCategory
            .filter((e) => e.annoKey.ns !== 'annis')
            .map(({ displayName, annoKey }) => ({
              caption: <span className="font-mono">{displayName}</span>,
              value: annoKeyToValue(annoKey),
            })),
        },
        {
          groupKey: 'annis',
          groupCaption: 'ANNIS',
          groupItems: exportableAnnoKeysForCategory
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
