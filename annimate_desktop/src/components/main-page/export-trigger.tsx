import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { dirname, save, shellOpen } from '@/lib/api';
import { ExportFormat } from '@/lib/api-types';
import { CancellableOperationError } from '@/lib/mutations';
import {
  useCanExport,
  useExportMatches,
  useGetExportFormat,
} from '@/lib/store';
import { formatPercentage } from '@/lib/utils';
import { File, Folder, Hourglass, X } from 'lucide-react';

const EXPORT_FORMAT_FILTERS: Record<
  ExportFormat,
  { name: string; extensions: string[] }[]
> = {
  csv: [{ name: 'Comma-separated values (*.csv)', extensions: ['csv'] }],
  xlsx: [{ name: 'Excel (*.xlsx)', extensions: ['xlsx'] }],
};

export const ExportTrigger = () => {
  const canExport = useCanExport();
  const getExportFormat = useGetExportFormat();
  const {
    mutation: { isPending: isExporting, mutate: exportMatches },
    matchCount,
    progress,
    cancelRequested,
    requestCancel,
  } = useExportMatches();
  const { toast } = useToast();

  return (
    <div className="flex-1">
      {isExporting ? (
        <div className="mb-1 flex items-end gap-8">
          <div className="grow">
            <div className="mb-1 flex justify-between">
              <p>
                {matchCount === undefined
                  ? 'Searching ...'
                  : `Exporting ${matchCount} match${matchCount === 1 ? '' : 'es'} ...`}
              </p>

              {progress !== undefined && (
                <p className="w-0 grow truncate text-right">
                  {formatPercentage(progress)}
                </p>
              )}
            </div>

            <Progress value={Math.round((progress ?? 0) * 100)} />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-8 p-0"
                disabled={cancelRequested}
                onClick={requestCancel}
                variant="destructive"
              >
                {cancelRequested ? (
                  <Hourglass className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            </TooltipTrigger>

            <TooltipContent>Stop export</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <Button
          className="mt-2 w-full"
          disabled={!canExport}
          onClick={async () => {
            const exportFormat = getExportFormat();
            const outputFile = await save({
              filters: EXPORT_FORMAT_FILTERS[exportFormat],
              title: 'Export to file',
            });
            if (outputFile !== null) {
              exportMatches(
                { outputFile },
                {
                  onError: (error: CancellableOperationError) => {
                    if (!error.cancelled) {
                      toast({
                        className: 'break-all',
                        description: error.message,
                        duration: 15000,
                        title: 'Export failed',
                        variant: 'destructive',
                      });
                    }
                  },
                  onSuccess: (_, { outputFile }) => {
                    toast({
                      description: (
                        <div className="flex gap-8">
                          <Button
                            className="px-0"
                            onClick={async () =>
                              shellOpen(await dirname(outputFile))
                            }
                            variant="link"
                          >
                            <Folder className="mr-2 size-4" />
                            Open folder
                          </Button>

                          <Button
                            className="px-0"
                            onClick={() => shellOpen(outputFile)}
                            variant="link"
                          >
                            <File className="mr-2 size-4" />
                            Open file
                          </Button>
                        </div>
                      ),
                      duration: 60000,
                      title: 'Export finished',
                      variant: 'success',
                    });
                  },
                },
              );
            }
          }}
        >
          Export to &hellip;
        </Button>
      )}
    </div>
  );
};
