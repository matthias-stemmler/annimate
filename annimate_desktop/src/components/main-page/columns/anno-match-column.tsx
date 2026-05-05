import { NodeAnnoSelect } from '@/components/main-page/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/main-page/columns/layout';
import { ColumnProps } from '@/components/main-page/columns/props';
import { QueryNodeSelect } from '@/components/main-page/columns/query-node-select';
import { Label } from '@/components/ui/label';
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

        <NodeAnnoSelect
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
