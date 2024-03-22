import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Label } from '@/components/ui/label';
import { FC, useId } from 'react';

export const AnnoDocumentColumn: FC<ColumnProps<'anno_document'>> = ({
  data,
  onChange,
}) => {
  const annoSelectId = useId();

  return (
    <ColumnConfigGrid>
      <ColumnConfigItem>
        <Label htmlFor={annoSelectId}>Meta annotation</Label>

        <AnnoSelect
          annoKey={data.annoKey}
          category="doc"
          id={annoSelectId}
          onChange={(annoKey) => onChange({ type: 'update_anno_key', annoKey })}
        />
      </ColumnConfigItem>
    </ColumnConfigGrid>
  );
};
