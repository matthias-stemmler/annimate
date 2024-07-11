import { ExportColumnList } from '@/components/main-page/export-column-list';
import { ExportFormatSelect } from '@/components/main-page/export-format-select';
import { ExportTrigger } from '@/components/main-page/export-trigger';

export const ExportSection = () => (
  <div className="h-full flex flex-col justify-between gap-2 pr-1">
    <ExportColumnList />

    <div className="flex justify-between items-end gap-8 mt-4">
      <ExportFormatSelect />
      <ExportTrigger />
    </div>
  </div>
);
