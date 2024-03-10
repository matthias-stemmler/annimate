import { AnnoSelect } from '@/components/columns/anno-select';
import {
  ColumnConfigGrid,
  ColumnConfigItem,
} from '@/components/columns/layout';
import { ColumnProps } from '@/components/columns/props';
import { FC } from 'react';

export const AnnoDocumentColumn: FC<ColumnProps<'anno_document'>> = ({
  data,
  onChange,
}) => (
  <ColumnConfigGrid>
    <ColumnConfigItem caption="Meta annotation">
      <AnnoSelect
        annoKey={data.annoKey}
        category="doc"
        onChange={(annoKey) => onChange({ annoKey })}
      />
    </ColumnConfigItem>
  </ColumnConfigGrid>
);
