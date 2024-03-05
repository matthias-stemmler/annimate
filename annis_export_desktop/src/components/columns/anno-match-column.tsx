import { AnnoSelect } from '@/components/columns/anno-select';
import { ColumnProps } from '@/components/columns/props';
import { useIsExporting } from '@/lib/store';
import { FC } from 'react';

export const AnnoMatchColumn: FC<ColumnProps<'anno_match'>> = ({
  data,
  onChange,
}) => {
  const isExporting = useIsExporting();
  const disabled = isExporting;

  return (
    <div className="flex gap-4 mb-2">
      <div className="flex-1">
        <p className="text-sm mb-1">Annotation</p>
        <AnnoSelect
          annoKey={data.annoKey}
          category="corpus"
          disabled={disabled}
          onChange={(annoKey) => onChange({ annoKey })}
        />
      </div>

      <div className="flex-1">
        <p className="text-sm mb-1">Query node</p>
      </div>
    </div>
  );
};
