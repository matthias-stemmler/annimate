import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/custom/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsExporting, useSegmentations } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Link2, Unlink2 } from 'lucide-react';
import { FC, useId } from 'react';

const CONTEXT_MIN = 0;
const CONTEXT_MAX = 999;

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

      <ContextInput
        value={data.context}
        valueRightOverride={data.contextRightOverride}
        onChange={(context) => onChange({ context })}
        onChangeRightOverride={(contextRightOverride) =>
          onChange({ contextRightOverride })
        }
      />
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

type ContextInputProps = {
  onChange?: (value: number) => void;
  onChangeRightOverride?: (value: number | undefined) => void;
  value: number;
  valueRightOverride: number | undefined;
};

const ContextInput: FC<ContextInputProps> = ({
  onChange,
  onChangeRightOverride,
  value,
  valueRightOverride,
}) => {
  const isExporting = useIsExporting();
  const disabled = isExporting;

  const leftInputId = useId();
  const rightInputId = useId();

  const isLinked = valueRightOverride === undefined;
  const rightValue = valueRightOverride ?? value;

  return (
    <div className="flex gap-2 items-end">
      <ColumnConfigItem>
        <Label htmlFor={leftInputId}>Left context</Label>

        <Input
          className="h-8 w-24"
          disabled={disabled}
          id={leftInputId}
          inputMode="numeric"
          onChange={(e) => {
            const value = parseNumber(e.target.value, CONTEXT_MIN, CONTEXT_MAX);
            if (value !== 'invalid') {
              onChange?.(value);
            }
          }}
          value={isNaN(value) ? '' : value}
        />
      </ColumnConfigItem>

      <div className="flex items-center h-8">
        <Button
          className="w-8"
          disabled={disabled}
          onClick={() => onChangeRightOverride?.(isLinked ? value : undefined)}
          size="icon"
          variant="link"
        >
          <div
            className={cn('border border-black w-2', {
              invisible: !isLinked,
            })}
          />
          {isLinked ? <Link2 /> : <Unlink2 />}
          <div
            className={cn('border border-black w-2', {
              invisible: !isLinked,
            })}
          />
        </Button>
      </div>

      <ColumnConfigItem>
        <Label htmlFor={rightInputId}>Right context</Label>

        <Input
          className="h-8 w-24"
          disabled={disabled}
          id={rightInputId}
          inputMode="numeric"
          onChange={(e) => {
            const value = parseNumber(e.target.value, CONTEXT_MIN, CONTEXT_MAX);
            if (value !== 'invalid') {
              if (isLinked) {
                onChange?.(value);
              } else {
                onChangeRightOverride?.(value);
              }
            }
          }}
          value={isNaN(rightValue) ? '' : rightValue}
        />
      </ColumnConfigItem>
    </div>
  );
};

const parseNumber = (
  value: string,
  min: number,
  max: number,
): number | 'invalid' => {
  if (value === '') {
    return NaN;
  }

  try {
    const numericValue = parseInt(value);
    return numericValue >= min && numericValue <= max
      ? numericValue
      : 'invalid';
  } catch {
    return 'invalid';
  }
};
