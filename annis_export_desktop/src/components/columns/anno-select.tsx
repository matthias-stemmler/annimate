import { annoKeyToValue, valueToAnnoKey } from '@/components/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { AnnoKey, ExportableAnnoKeyCategory } from '@/lib/api-types';
import { useExportableAnnoKeys } from '@/lib/store';
import { FC } from 'react';

export type AnnoSelectProps = {
  annoKey: AnnoKey | undefined;
  category: ExportableAnnoKeyCategory;
  disabled?: boolean;
  onChange?: (annoKey: AnnoKey) => void;
};

export const AnnoSelect: FC<AnnoSelectProps> = ({
  annoKey,
  category,
  disabled,
  onChange,
}) => {
  const {
    data: exportableAnnoKeys,
    error,
    isPending,
  } = useExportableAnnoKeys();

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error}`);
  }

  return (
    <Select
      disabled={disabled}
      loading={isPending}
      monoFont
      onChange={(value) => onChange?.(valueToAnnoKey(value))}
      options={(exportableAnnoKeys?.[category] ?? []).map((e) => ({
        caption: e.displayName,
        value: annoKeyToValue(e.annoKey),
      }))}
      triggerClassName="h-8"
      value={annoKey === undefined ? undefined : annoKeyToValue(annoKey)}
    />
  );
};
