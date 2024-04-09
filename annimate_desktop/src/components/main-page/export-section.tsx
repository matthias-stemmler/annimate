import { ExportColumnList } from '@/components/main-page/export-column-list';
import { ExportTrigger } from '@/components/main-page/export-trigger';

export const ExportSection = () => (
  <div className="h-full flex flex-col justify-between gap-2">
    <ExportColumnList />
    <ExportTrigger />
  </div>
);
