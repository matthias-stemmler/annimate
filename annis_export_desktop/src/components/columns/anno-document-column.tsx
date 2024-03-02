import { ColumnProps } from '@/components/columns/props';
import { annoKeyToValue, valueToAnnoKey } from '@/components/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { useDocAnnoKeys, useIsExporting } from '@/lib/store';
import { FC } from 'react';

export const AnnoDocumentColumn: FC<ColumnProps<'anno_document'>> = ({
  data,
  onChange,
}) => {
  const { data: docAnnoKeys, error, isPending } = useDocAnnoKeys();

  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error}`);
  }

  return (
    <div className="w-1/2 mb-2">
      <p className="text-sm mb-1">Meta annotation</p>
      <Select
        disabled={disabled}
        loading={isPending}
        onChange={(value) =>
          onChange({
            annoKey: value === undefined ? undefined : valueToAnnoKey(value),
          })
        }
        optionClassName="font-mono"
        options={(docAnnoKeys ?? []).map((e) => ({
          caption: e.displayName,
          value: annoKeyToValue(e.annoKey),
        }))}
        triggerClassName="h-8"
        value={
          data.annoKey === undefined ? undefined : annoKeyToValue(data.annoKey)
        }
      />
    </div>
  );
};
