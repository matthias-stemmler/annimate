import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Select, SelectOption } from '@/components/ui/custom/select';
import { QueryNodeRef } from '@/lib/api-types';
import { useIsExporting, useQueryNodes } from '@/lib/store';
import { groupBy } from '@/lib/utils';
import { FC } from 'react';

export const AnnoMatchColumn: FC<ColumnProps<'anno_match'>> = ({
  data,
  onChange,
}) => (
  <ColumnConfigGrid>
    <ColumnConfigItem caption="Annotation">
      <AnnoSelect
        annoKey={data.annoKey}
        category="node"
        onChange={(annoKey) => onChange({ annoKey })}
      />
    </ColumnConfigItem>

    <ColumnConfigItem caption="Query node">
      <QueryNodeSelect
        nodeRef={data.nodeRef}
        onChange={(nodeRef) => onChange({ nodeRef })}
      />
    </ColumnConfigItem>
  </ColumnConfigGrid>
);

type QueryNodeSelectProps = {
  nodeRef: QueryNodeRef | undefined;
  onChange?: (nodeRef: QueryNodeRef) => void;
};

const QueryNodeSelect: FC<QueryNodeSelectProps> = ({ nodeRef, onChange }) => {
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
            <div className="flex gap-2 mr-2">
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
