import { AnnoSelect } from '@/components/main-page/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/main-page/columns/layout';
import { ColumnProps } from '@/components/main-page/columns/props';
import { QueryNodesDisplay } from '@/components/main-page/columns/query-nodes-display';
import { Select, SelectOption } from '@/components/ui/custom/select';
import { Label } from '@/components/ui/label';
import { QueryNodeRef } from '@/lib/api-types';
import { useIsExporting, useQueryNodes } from '@/lib/store';
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
          onChange={(annoKey) => onChange({ type: 'update_anno_key', annoKey })}
        />
      </ColumnConfigItem>

      <ColumnConfigItem>
        <Label htmlFor={queryNodeSelectId}>Query node</Label>

        <QueryNodeSelect
          id={queryNodeSelectId}
          nodeRef={data.nodeRef}
          onChange={(nodeRef) => onChange({ type: 'update_node_ref', nodeRef })}
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
      options={nodes.map(
        (ns, i): SelectOption<`${number}`> => ({
          caption: <QueryNodesDisplay queryNodes={ns} />,
          value: `${i}`,
        }),
      )}
      triggerClassName="h-8"
      value={nodeRef === undefined ? undefined : `${nodeRef.index}`}
    />
  );
};
