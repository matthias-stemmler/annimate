import { ExportColumnList } from '@/components/export-column-list';
import { ExportTrigger } from '@/components/export-trigger';

export const ExportSection = () => (
  <div className="h-full flex flex-col justify-between gap-2">
    <ExportColumnList />
    <ExportTrigger />
  </div>
);
