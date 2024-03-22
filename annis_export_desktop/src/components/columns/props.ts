import { ExportColumnData, ExportColumnType } from '@/lib/api-types';
import { ExportColumnUpdate } from '@/lib/store';

export type ColumnProps<T extends ExportColumnType> = {
  data: ExportColumnData<T>;
  onChange: (payload: (ExportColumnUpdate & { type: T })['payload']) => void;
};
