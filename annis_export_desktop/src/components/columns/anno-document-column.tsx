import { AnnoSelect } from '@/components/columns/anno-select';
import { ColumnProps } from '@/components/columns/props';
import { useIsExporting } from '@/lib/store';
import { FC } from 'react';

export const AnnoDocumentColumn: FC<ColumnProps<'anno_document'>> = ({
  data,
  onChange,
}) => {
  const isExporting = useIsExporting();
  const disabled = isExporting;

  return (
    <div className="w-1/2 mb-2">
      <p className="text-sm mb-1">Meta annotation</p>
      <AnnoSelect
        annoKey={data.annoKey}
        category="doc"
        disabled={disabled}
        onChange={(annoKey) => onChange({ annoKey })}
      />
    </div>
  );
};
