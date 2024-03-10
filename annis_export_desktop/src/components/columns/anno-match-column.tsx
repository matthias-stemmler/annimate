import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Select, SelectOption } from '@/components/ui/custom/select';
import { QueryNodeRef } from '@/lib/api-types';
import { useIsExporting, useQueryNodes } from '@/lib/store';
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

export type QueryNodeSelectProps = {
  nodeRef: QueryNodeRef | undefined;
  onChange?: (nodeRef: QueryNodeRef) => void;
};

export const QueryNodeSelect: FC<QueryNodeSelectProps> = ({
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
      loading={isPending}
      monoFont
      onChange={(value) => {
        const index = parseInt(value);
        const variables = nodes[index].map((n) => n.variable);

        onChange?.({
          index,
          variables,
        });
      }}
      options={nodes.map(
        (ns, i): SelectOption<`${number}`> => ({
          caption: ns
            .map(
              ({ queryFragment, variable }) => `#${variable} ${queryFragment}`,
            )
            .join(' | '),
          value: `${i}`,
        }),
      )}
      triggerClassName="h-8"
      value={nodeRef === undefined ? undefined : `${nodeRef.index}`}
    />
  );
};
