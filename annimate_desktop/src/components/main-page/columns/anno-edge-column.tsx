import { EdgeAnnoSelect } from '@/components/main-page/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/main-page/columns/layout';
import { ColumnProps } from '@/components/main-page/columns/props';
import { QueryNodeSelect } from '@/components/main-page/columns/query-node-select';
import {
  edgeTypeToValue,
  valueToEdgeType,
} from '@/components/main-page/columns/utils';
import { Select } from '@/components/ui/custom/select';
import { Label } from '@/components/ui/label';
import { EdgeType } from '@/lib/api-types';
import { useExportableEdgeTypes, useIsExporting } from '@/lib/store';
import { FC, useId } from 'react';

export const AnnoEdgeColumn: FC<ColumnProps<'anno_edge'>> = ({
  data,
  onChange,
}) => {
  const edgeTypeSelectId = useId();
  const annoSelectId = useId();
  const sourceQueryNodeSelectId = useId();
  const targetQueryNodeSelectId = useId();

  return (
    <ColumnConfigGrid>
      <ColumnConfigItem>
        <Label htmlFor={edgeTypeSelectId}>Edge type</Label>

        <EdgeTypeSelect
          edgeType={data.edgeType}
          id={edgeTypeSelectId}
          onChange={(edgeType) =>
            onChange({ type: 'update_edge_type', edgeType })
          }
        />
      </ColumnConfigItem>

      <ColumnConfigItem>
        <Label htmlFor={sourceQueryNodeSelectId}>Source query node</Label>

        <QueryNodeSelect
          id={sourceQueryNodeSelectId}
          nodeRef={data.sourceNodeRef}
          onChange={(sourceNodeRef) =>
            onChange({ type: 'update_source_node_ref', sourceNodeRef })
          }
        />
      </ColumnConfigItem>

      <ColumnConfigItem>
        <Label htmlFor={annoSelectId}>Annotation</Label>

        <EdgeAnnoSelect
          annoKey={data.annoKey}
          edgeType={data.edgeType}
          id={annoSelectId}
          onChange={(annoKey) => onChange({ type: 'update_anno_key', annoKey })}
        />
      </ColumnConfigItem>

      <ColumnConfigItem>
        <Label htmlFor={targetQueryNodeSelectId}>Target query node</Label>

        <QueryNodeSelect
          id={targetQueryNodeSelectId}
          nodeRef={data.targetNodeRef}
          onChange={(targetNodeRef) =>
            onChange({ type: 'update_target_node_ref', targetNodeRef })
          }
        />
      </ColumnConfigItem>
    </ColumnConfigGrid>
  );
};

type EdgeTypeSelectProps = {
  edgeType: EdgeType | undefined;
  id?: string;
  onChange?: (edgeType: EdgeType) => void;
};

const EdgeTypeSelect: FC<EdgeTypeSelectProps> = ({
  edgeType,
  id,
  onChange,
}) => {
  const {
    data: exportableEdgeTypes,
    error,
    isPending,
  } = useExportableEdgeTypes();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to load exportable edge types: ${error.message}`);
  }

  return (
    <Select
      className="h-8"
      disabled={disabled}
      id={id}
      loading={isPending}
      onChange={(value) => onChange?.(valueToEdgeType(value))}
      options={(exportableEdgeTypes ?? []).map(({ edgeType }) => ({
        caption: `${edgeType.ctype}/${edgeType.name}`, // TODO
        value: edgeTypeToValue(edgeType),
      }))}
      value={edgeType === undefined ? undefined : edgeTypeToValue(edgeType)}
    />
  );
};
