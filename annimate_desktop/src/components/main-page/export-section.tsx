import { ExportColumnList } from '@/components/main-page/export-column-list';
import { ExportFormatSelect } from '@/components/main-page/export-format-select';
import { ExportTrigger } from '@/components/main-page/export-trigger';

export const ExportSection = () => (
  <div className="flex h-full flex-col justify-between gap-2">
    <ExportColumnList />

    <div className="mt-4 flex items-end justify-between gap-8 pr-1">
      <ExportFormatSelect />
      <ExportTrigger />
    </div>
  </div>
);
