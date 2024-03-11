import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Select } from '@/components/ui/custom/select';
import { Label } from '@/components/ui/label';
import { useIsExporting, useSegmentations } from '@/lib/store';
import { FC, useId } from 'react';

export const MatchInContextColumn: FC<ColumnProps<'match_in_context'>> = ({
  data,
  onChange,
}) => {
  const segmentationSelectId = useId();

  return (
    <ColumnConfigGrid>
      <ColumnConfigItem>
        <Label htmlFor={segmentationSelectId}>Segmentation</Label>

        <SegmentationSelect
          id={segmentationSelectId}
          segmentation={data.segmentation}
          onChange={(segmentation) => onChange({ segmentation })}
        />
      </ColumnConfigItem>
    </ColumnConfigGrid>
  );
};

type SegmentationSelectProps = {
  id?: string;
  segmentation: string | undefined;
  onChange?: (segmentation: string) => void;
};

const SegmentationSelect: FC<SegmentationSelectProps> = ({
  id,
  segmentation,
  onChange,
}) => {
  const { data: segmentations, error, isPending } = useSegmentations();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to determine segmentations: ${error}`);
  }

  return (
    <Select
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(value) => onChange?.(value?.slice(1))}
      options={(segmentations ?? []).map((s) => ({
        caption:
          s === '' ? (
            <span className="italic">Tokens (default)</span>
          ) : (
            <span className="font-mono">{s}</span>
          ),
        value: `:${s}`,
      }))}
      triggerClassName="h-8"
      value={segmentation === undefined ? undefined : `:${segmentation}`}
    />
  );
};
