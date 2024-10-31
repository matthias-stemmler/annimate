import { AutoScroller } from '@/components/ui/custom/auto-scroller';
import { ExportColumnData, ExportColumnType } from '@/lib/api-types';
import { ExportColumnUpdate } from '@/lib/store';

export type ColumnProps<T extends ExportColumnType> = {
  autoScroller?: AutoScroller;
  data: ExportColumnData<T>;
  onChange: (payload: (ExportColumnUpdate & { type: T })['payload']) => void;
};
