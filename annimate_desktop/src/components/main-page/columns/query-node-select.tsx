import { Select, SelectOption } from '@/components/ui/custom/select';
import { QueryNodeRef } from '@/lib/api-types';
import { useIsExporting, useQueryNodes } from '@/lib/store';
import { FC } from 'react';
import { QueryNodesDisplay } from '@/components/main-page/columns/query-nodes-display';

export type QueryNodeSelectProps = {
  id?: string;
  nodeRef: QueryNodeRef | undefined;
  onChange?: (nodeRef: QueryNodeRef) => void;
};

export const QueryNodeSelect: FC<QueryNodeSelectProps> = ({
  id,
  nodeRef,
  onChange,
}) => {
  const { data: queryNodes, error, isPending } = useQueryNodes();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to determine query nodes: ${error.message}`);
  }

  const nodes = queryNodes?.type === 'valid' ? queryNodes.nodes : [];

  return (
    <Select
      className="h-8"
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(value) => {
        const index = parseInt(value);
        const group = nodes[index];
        if (group === undefined) {
          return;
        }

        onChange?.({
          index,
          variables: group.map((n) => n.variable),
        });
      }}
      options={nodes.map((group, i): SelectOption<`${number}`> => ({
        caption: <QueryNodesDisplay queryNodes={group} />,
        value: `${i}`,
      }))}
      value={nodeRef === undefined ? undefined : `${nodeRef.index}`}
    />
  );
};
