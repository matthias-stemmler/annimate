import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { FC } from 'react';

export const AnnoCorpusColumn: FC<ColumnProps<'anno_corpus'>> = ({
  data,
  onChange,
}) => (
  <ColumnConfigGrid>
    <ColumnConfigItem caption="Meta annotation">
      <AnnoSelect
        annoKey={data.annoKey}
        category="corpus"
        onChange={(annoKey) => onChange({ annoKey })}
      />
    </ColumnConfigItem>
  </ColumnConfigGrid>
);
