import { Button } from '@/components/ui/button';
import { ProgressPercent } from '@/components/ui/custom/progress-percent';
import { useToast } from '@/components/ui/use-toast';
import { dirname, open, save } from '@/lib/api';
import { useCanExport, useExportMatches } from '@/lib/store';
import { File, Folder } from 'lucide-react';

export const ExportTrigger = () => {
  const canExport = useCanExport();
  const {
    mutation: { isPending: isExporting, mutate: exportMatches },
    matchCount,
    progress,
  } = useExportMatches();
  const { toast } = useToast();

  return isExporting ? (
    <div className="mt-2 mb-1">
      <p className="mb-1">
        {matchCount === undefined
          ? 'Searching ...'
          : `Exporting ${matchCount} match${matchCount === 1 ? '' : 'es'} ...`}
      </p>
      <ProgressPercent value={progress} />
    </div>
  ) : (
    <Button
      className="w-full mt-4"
      disabled={!canExport}
      onClick={async () => {
        const outputFile = await save();
        if (outputFile !== null) {
          exportMatches(
            { outputFile },
            {
              onError: (error: Error) => {
                toast({
                  className: 'break-all',
                  description: error.toString(),
                  duration: 15000,
                  title: 'Export failed',
                  variant: 'destructive',
                });
              },
              onSuccess: (_, { outputFile }) => {
                toast({
                  description: (
                    <div className="flex gap-8">
                      <Button
                        className="px-0"
                        onClick={async () => open(await dirname(outputFile))}
                        variant="link"
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        Open folder
                      </Button>

                      <Button
                        className="px-0"
                        onClick={() => open(outputFile)}
                        variant="link"
                      >
                        <File className="h-4 w-4 mr-2" />
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
  );
};
