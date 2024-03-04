import { ColumnProps } from '@/components/columns/props';
import { annoKeyToValue, valueToAnnoKey } from '@/components/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { useIsExporting, useNodeAnnoKeys } from '@/lib/store';
import { FC } from 'react';

export const AnnoMatchColumn: FC<ColumnProps<'anno_match'>> = ({
  data,
  onChange,
}) => {
  const { data: nodeAnnoKeys, error, isPending } = useNodeAnnoKeys();

  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable annotations: ${error}`);
  }

  return (
    <div className="w-1/2 mb-2">
      <p className="text-sm mb-1">Annotation</p>
      <Select
        disabled={disabled}
        loading={isPending}
        monoFont
        onChange={(value) =>
          onChange({
            annoKey: value === undefined ? undefined : valueToAnnoKey(value),
          })
        }
        options={(nodeAnnoKeys ?? []).map((e) => ({
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
