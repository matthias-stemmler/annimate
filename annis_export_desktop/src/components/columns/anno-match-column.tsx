import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Select, SelectOption } from '@/components/ui/custom/select';
import { Label } from '@/components/ui/label';
import { QueryNodeRef } from '@/lib/api-types';
import { useIsExporting, useQueryNodes } from '@/lib/store';
import { groupBy } from '@/lib/utils';
import { FC, useId } from 'react';

export const AnnoMatchColumn: FC<ColumnProps<'anno_match'>> = ({
  data,
  onChange,
}) => {
  const annoSelectId = useId();
  const queryNodeSelectId = useId();

  return (
    <ColumnConfigGrid>
      <ColumnConfigItem>
        <Label htmlFor={annoSelectId}>Annotation</Label>

        <AnnoSelect
          annoKey={data.annoKey}
          category="node"
          id={annoSelectId}
          onChange={(annoKey) => onChange({ annoKey })}
        />
      </ColumnConfigItem>

      <ColumnConfigItem>
        <Label htmlFor={queryNodeSelectId}>Query node</Label>

        <QueryNodeSelect
          id={queryNodeSelectId}
          nodeRef={data.nodeRef}
          onChange={(nodeRef) => onChange({ nodeRef })}
        />
      </ColumnConfigItem>
    </ColumnConfigGrid>
  );
};

type QueryNodeSelectProps = {
  id?: string;
  nodeRef: QueryNodeRef | undefined;
  onChange?: (nodeRef: QueryNodeRef) => void;
};

const QueryNodeSelect: FC<QueryNodeSelectProps> = ({
  id,
  nodeRef,
  onChange,
}) => {
  const { data: queryNodes, error, isPending } = useQueryNodes();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to determine query nodes: ${error}`);
  }

  const nodes = queryNodes?.type === 'valid' ? queryNodes.nodes : [];

  return (
    <Select
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(value) => {
        const index = parseInt(value);
        const variables = nodes[index].map((n) => n.variable);

        onChange?.({
          index,
          variables,
        });
      }}
      options={nodes.map((ns, i): SelectOption<`${number}`> => {
        const options = groupBy(ns, (n) => n.queryFragment);

        return {
          caption: (
            <div className="flex gap-2 mr-2 font-mono">
              {options.map(([queryFragment, nodesForQueryFragment]) => (
                <div
                  key={queryFragment}
                  className="min-w-0 flex items-center gap-2 px-2 bg-gray-500 text-white rounded-sm"
                >
                  {nodesForQueryFragment.map(({ variable }, i) => (
                    <span
                      key={i}
                      className="max-w-32 overflow-hidden text-ellipsis font-semibold"
                    >
                      #{variable}
                    </span>
                  ))}
                  <span className="flex-1 max-w-64 overflow-hidden text-ellipsis">
                    {queryFragment}
                  </span>
                </div>
              ))}
            </div>
          ),
          value: `${i}`,
        };
      })}
      triggerClassName="h-8"
      value={nodeRef === undefined ? undefined : `${nodeRef.index}`}
    />
  );
};
