import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { Label } from '@/components/ui/label';
import { FC, useId } from 'react';

export const AnnoCorpusColumn: FC<ColumnProps<'anno_corpus'>> = ({
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
          category="corpus"
          id={annoSelectId}
          onChange={(annoKey) => onChange({ annoKey })}
        />
      </ColumnConfigItem>
    </ColumnConfigGrid>
  );
};
