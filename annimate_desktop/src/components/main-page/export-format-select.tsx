import { Select } from '@/components/ui/custom/select';
import {
  useExportFormat,
  useIsExporting,
  useSetExportFormat,
} from '@/lib/store';
import { FC } from 'react';

export const ExportFormatSelect: FC = () => {
  const exportFormat = useExportFormat();
  const setExportFormat = useSetExportFormat();
  const isExporting = useIsExporting();

  return (
    <Select
      className="max-w-24"
      disabled={isExporting}
      onChange={setExportFormat}
      options={[
        { caption: 'CSV', value: 'csv' },
        { caption: 'Excel', value: 'xlsx' },
      ]}
      value={exportFormat}
    />
  );
};
