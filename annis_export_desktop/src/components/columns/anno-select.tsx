import { annoKeyToValue, valueToAnnoKey } from '@/components/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { AnnoKey, ExportableAnnoKeyCategory } from '@/lib/api-types';
import { useExportableAnnoKeys, useIsExporting } from '@/lib/store';
import { FC } from 'react';

export type AnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  category: ExportableAnnoKeyCategory;
  onChange?: (annoKey: AnnoKey) => void;
};

export const AnnoSelect: FC<AnnoSelectProps> = ({
  annoKey,
  category,
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
    throw new Error(`Failed to load exportable annotations: ${error}`);
  }

  return (
    <Select
      disabled={disabled}
      loading={isPending}
      onChange={(value) => onChange?.(valueToAnnoKey(value))}
      options={(exportableAnnoKeys?.[category] ?? []).map((e) => ({
        caption: <span className="font-mono">{e.displayName}</span>,
        value: annoKeyToValue(e.annoKey),
      }))}
      triggerClassName="h-8"
      value={annoKey === undefined ? undefined : annoKeyToValue(annoKey)}
    />
  );
};
