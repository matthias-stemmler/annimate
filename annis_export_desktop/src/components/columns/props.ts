import { ExportColumnData, ExportColumnType } from '@/lib/api';

export type ColumnProps<T extends ExportColumnType> = {
  data: ExportColumnData<T>;
  onChange: (data: ExportColumnData<T>) => void;
};
