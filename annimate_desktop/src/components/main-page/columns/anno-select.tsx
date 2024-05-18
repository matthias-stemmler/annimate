import {
  annoKeyToValue,
  valueToAnnoKey,
} from '@/components/main-page/columns/utils';
import { Select, SelectOption } from '@/components/ui/custom/select';
import {
  AnnoKey,
  ExportableAnnoKey,
  ExportableAnnoKeyCategory,
} from '@/lib/api-types';
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
          groupKey: 'non-annis',
          groupItems: exportableAnnoKeysForCategory
            .filter((e) => e.annoKey.ns !== 'annis')
            .map(toOption),
        },
        {
          groupKey: 'annis',
          groupCaption: 'Annis',
          groupItems: exportableAnnoKeysForCategory
            .filter((e) => e.annoKey.ns === 'annis')
            .map(toOption),
        },
      ]}
      value={annoKey === undefined ? undefined : annoKeyToValue(annoKey)}
    />
  );
};

const toOption = ({
  displayName,
  annoKey,
}: ExportableAnnoKey): SelectOption<string> => ({
  caption: <span className="font-mono">{displayName}</span>,
  value: annoKeyToValue(annoKey),
});
