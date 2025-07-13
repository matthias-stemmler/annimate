import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { documentDir, openPath, revealItemInDir, save } from '@/lib/api';
import { CancellableOperationError } from '@/lib/mutations';
import {
  useExportMatches,
  useExportPreflight,
  useGetExportFormat,
} from '@/lib/store';
import { cn, formatPercentage } from '@/lib/utils';
import { CheckSquare2, File, Folder, Hourglass, Info, X } from 'lucide-react';
import { Fragment } from 'react';

const EXPORT_FORMAT_FILTERS = {
  csv: [{ name: 'Comma-separated values (*.csv)', extensions: ['csv'] }],
  xlsx: [{ name: 'Excel (*.xlsx)', extensions: ['xlsx'] }],
};

export const ExportTrigger = () => {
  const { canExport, impediments } = useExportPreflight();
  const getExportFormat = useGetExportFormat();
  const {
    mutation: { isPending: isExporting, mutate: exportMatches },
    matchCount,
    progress,
    cancelRequested,
    requestCancel,
  } = useExportMatches();
  const { dismiss: dismissToast, toast } = useToast();

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
        <div className="mt-2 flex items-center gap-8">
          <Button
            className="grow"
            disabled={!canExport}
            onClick={async () => {
              const exportFormat = getExportFormat();
              const outputFile = await save({
                defaultPath: await documentDir(),
                filters: EXPORT_FORMAT_FILTERS[exportFormat],
                title: 'Export to file',
              });

              if (outputFile !== null) {
                dismissToast();

                exportMatches(
                  { outputFile },
                  {
                    onError: (error: CancellableOperationError) => {
                      if (!error.cancelled) {
                        toast({
                          className: 'break-all',
                          description: error.message
                            .split('\n')
                            .map((line, index) => (
                              <Fragment key={index}>
                                {index > 0 && <br />}
                                {line}
                              </Fragment>
                            )),
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
                              onClick={async () => revealItemInDir(outputFile)}
                              variant="link"
                            >
                              <Folder className="mr-2 size-4" />
                              Open folder
                            </Button>

                            <Button
                              className="px-0"
                              onClick={() => openPath(outputFile)}
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

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {/* The icon paths don't fill their full SVG viewboxes, so we scale them up.
                  The check icon is supposed to have rounded corners, but the corners are part of the stroke, which is white.
                  So we achieve the rounding effect by clipping at the boundaries of the button, which has rounded corners itself.
                  We cannot clip the info icon though, because the circle would be cut off. */}
              <Button
                className="size-6 rounded-sm hover:bg-inherit has-data-clip:overflow-clip"
                size="icon"
                variant="ghost"
              >
                {canExport ? (
                  <CheckSquare2
                    className="size-full scale-150 fill-green-700 text-white"
                    data-clip
                  />
                ) : (
                  <Info className="size-full scale-150 fill-blue-800 text-white" />
                )}
              </Button>
            </TooltipTrigger>

            <TooltipContent className="mr-2">
              {canExport ? (
                <>Ready to export</>
              ) : (
                <>
                  Cannot export:
                  <ul
                    className={cn(
                      impediments.length > 1 && 'list-inside list-disc',
                    )}
                  >
                    {impediments.map((impediment, index) => (
                      <li key={index}>{impediment}</li>
                    ))}
                  </ul>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
