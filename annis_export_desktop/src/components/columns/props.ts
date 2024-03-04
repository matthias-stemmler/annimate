import { ExportColumnData, ExportColumnType } from '@/lib/api-types';

export type ColumnProps<T extends ExportColumnType> = {
  data: ExportColumnData<T>;
  onChange: (data: ExportColumnData<T>) => void;
};
