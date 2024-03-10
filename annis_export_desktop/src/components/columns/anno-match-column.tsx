import { AnnoSelect } from '@/components/columns/anno-select';
import { ColumnProps } from '@/components/columns/props';
import { Select, SelectOption } from '@/components/ui/custom/select';
import { useIsExporting, useQueryNodes } from '@/lib/store';
import { FC } from 'react';

export const AnnoMatchColumn: FC<ColumnProps<'anno_match'>> = ({
  data,
  onChange,
}) => (
  <div className="flex gap-4 mb-2">
    <div className="flex-1">
      <p className="text-sm mb-1">Annotation</p>
      <AnnoSelect
        annoKey={data.annoKey}
        category="node"
        onChange={(annoKey) => onChange({ annoKey })}
      />
    </div>

    <div className="flex-1">
      <p className="text-sm mb-1">Query node</p>
      <QueryNodeSelect
        index={data.index}
        onChange={(index) => onChange({ index })}
      />
    </div>
  </div>
);

export type QueryNodeSelectProps = {
  index: number | undefined;
  onChange?: (index: number) => void;
};

export const QueryNodeSelect: FC<QueryNodeSelectProps> = ({
  index,
  onChange,
}) => {
  const { data: queryNodes, error, isPending } = useQueryNodes();
  const isExporting = useIsExporting();
  const disabled = isExporting;

  if (error !== null) {
    throw new Error(`Failed to determine query nodes: ${error}`);
  }

  return (
    <Select
      disabled={disabled}
      loading={isPending}
      monoFont
      onChange={(value) => onChange?.(parseInt(value))}
      options={
        queryNodes?.type === 'valid'
          ? queryNodes.nodes.map(
              (ns, i): SelectOption<`${number}`> => ({
                caption: ns
                  .map(
                    ({ queryFragment, variable }) =>
                      `#${variable} ${queryFragment}`,
                  )
                  .join(' | '),
                value: `${i}`,
              }),
            )
          : []
      }
      triggerClassName="h-8"
      value={index === undefined ? undefined : `${index}`}
    />
  );
};
