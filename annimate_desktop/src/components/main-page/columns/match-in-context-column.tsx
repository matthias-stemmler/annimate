import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/main-page/columns/layout';
import { ColumnProps } from '@/components/main-page/columns/props';
import { QueryNodesDisplay } from '@/components/main-page/columns/query-nodes-display';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AutoScroller } from '@/components/ui/custom/auto-scroller';
import { ReorderList } from '@/components/ui/custom/reorder-list';
import { Select } from '@/components/ui/custom/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueryNode, QueryNodeRef } from '@/lib/api-types';
import {
  CONTEXT_MAX,
  CONTEXT_MIN,
  useIsExporting,
  useQueryNodes,
  useSegmentations,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { GripVertical, Link2, Unlink2 } from 'lucide-react';
import { FC, useId } from 'react';

export const MatchInContextColumn: FC<ColumnProps<'match_in_context'>> = ({
  autoScroller,
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
          onChange={(segmentation) =>
            onChange({ type: 'update_segmentation', segmentation })
          }
        />
      </ColumnConfigItem>

      <ContextInput
        value={data.context}
        valueRightOverride={data.contextRightOverride}
        onChange={(context) => onChange({ type: 'update_context', context })}
        onChangeRightOverride={(contextRightOverride) =>
          onChange({
            type: 'update_context_right_override',
            contextRightOverride,
          })
        }
      />

      <ColumnConfigItem wide>
        <Label>Query node filter</Label>

        <PrimaryNodesSelect
          autoScroller={autoScroller}
          onReorder={(reorder: (nodeRefs: QueryNodeRef[]) => QueryNodeRef[]) =>
            onChange({ type: 'reorder_primary_node_refs', reorder })
          }
          onToggle={(nodeRef: QueryNodeRef) =>
            onChange({ type: 'toggle_primary_node_ref', nodeRef })
          }
          primaryNodeRefs={data.primaryNodeRefs}
          secondaryNodeRefs={data.secondaryNodeRefs}
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
    throw new Error(`Failed to determine segmentations: ${error.message}`);
  }

  return (
    <Select
      className="h-8"
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
    <div className="flex items-end gap-2">
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

      <div className="flex h-8 items-center">
        <Button
          className="w-8"
          disabled={disabled}
          onClick={() => onChangeRightOverride?.(isLinked ? value : undefined)}
          size="icon"
          variant="link"
        >
          <div
            className={cn('w-2 border border-black', {
              invisible: !isLinked,
            })}
          />
          {isLinked ? <Link2 /> : <Unlink2 />}
          <div
            className={cn('w-2 border border-black', {
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

type PrimaryNodesSelectProps = {
  autoScroller?: AutoScroller;
  onReorder?: (reorder: (nodeRefs: QueryNodeRef[]) => QueryNodeRef[]) => void;
  onToggle?: (nodeRef: QueryNodeRef) => void;
  primaryNodeRefs: QueryNodeRef[];
  secondaryNodeRefs: QueryNodeRef[];
};

const PrimaryNodesSelect: FC<PrimaryNodesSelectProps> = ({
  autoScroller,
  onReorder,
  onToggle,
  primaryNodeRefs,
  secondaryNodeRefs,
}) => {
  const { data: queryNodes, error } = useQueryNodes();
  const isExporting = useIsExporting();
  const disabled = isExporting;
  const reorderDisabled = disabled || primaryNodeRefs.length <= 1;

  if (error !== null) {
    throw new Error(`Failed to determine query nodes: ${error.message}`);
  }

  const nodes = queryNodes?.type === 'valid' ? queryNodes.nodes : [];

  if (nodes.length === 0) {
    return (
      <div className="h-7 text-sm text-gray-500">No query nodes available</div>
    );
  }

  return (
    <div>
      <ReorderList
        autoScroller={autoScroller}
        disabled={disabled}
        getId={getNodeRefId}
        idPrefix="primary-nodes"
        items={primaryNodeRefs}
        onReorder={(reorder) =>
          onReorder?.((nodeRefs) => reorder(nodeRefs, getNodeRefId))
        }
        renderItem={(
          nodeRef,
          {
            dragHandleAttributes,
            dragHandleListeners,
            isOverlay,
            isPlaceholder,
            ref,
            style,
          },
        ) => (
          <div
            className={cn('flex items-center', {
              'opacity-30': isPlaceholder,
            })}
            ref={ref}
            style={style}
          >
            <Button
              className={cn('h-5 min-w-5 cursor-grab p-0 hover:bg-inherit', {
                'cursor-grabbing': isOverlay || isPlaceholder,
              })}
              disabled={reorderDisabled}
              variant="ghost"
              {...dragHandleAttributes}
              {...dragHandleListeners}
            >
              <GripVertical className="size-4" />
            </Button>
            <QueryNodesSelectItem
              checked
              disabled={disabled}
              label={nodeRef.variables.map((v) => `#${v}`).join(' | ')}
              onClick={() => onToggle?.(nodeRef)}
              queryNodes={nodes[nodeRef.index]}
            />
          </div>
        )}
      />
      {secondaryNodeRefs.map((n) => (
        <QueryNodesSelectItem
          key={n.index}
          checked={false}
          className="ml-5"
          disabled={disabled}
          label={n.variables.map((v) => `#${v}`).join(' | ')}
          onClick={() => onToggle?.(n)}
          queryNodes={nodes[n.index]}
        />
      ))}
    </div>
  );
};

const getNodeRefId = (nodeRef: QueryNodeRef): string => `${nodeRef.index}`;

type QueryNodesSelectItemProps = {
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  queryNodes: QueryNode[];
};

const QueryNodesSelectItem: FC<QueryNodesSelectItemProps> = ({
  checked,
  className,
  disabled,
  label,
  onClick,
  queryNodes,
}) => {
  const id = useId();

  return (
    <Label
      htmlFor={id}
      className={cn(
        'flex items-center gap-2 overflow-hidden p-1 has-disabled:cursor-not-allowed has-disabled:opacity-70',
        className,
      )}
    >
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onClick={onClick}
      />
      <QueryNodesDisplay queryNodes={queryNodes} />
    </Label>
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
