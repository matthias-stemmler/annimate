import { ExportTrigger } from '@/components/export-trigger';

export const ExportSection = () => (
  <div className="h-full flex flex-col justify-between mx-4 pb-4">
    <div>Export Config</div>
    <ExportTrigger />
  </div>
);
