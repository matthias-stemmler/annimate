import { Button } from '@/components/ui/button';
import { ProgressPercent } from '@/components/ui/custom/progress-percent';
import { useToast } from '@/components/ui/use-toast';
import { dirname, open, save } from '@/lib/api';
import { useClientState } from '@/lib/client-state-context';
import { useExportMatches } from '@/lib/mutations';
import { useQueryValidationResult } from '@/lib/queries';
import { File, Folder } from 'lucide-react';

export const ExportTrigger = () => {
  const { toast } = useToast();
  const {
    aqlQuery: { value: aqlQuery },
    queryLanguage,
    selectedCorpusNames,
  } = useClientState();
  const {
    mutation: { isPending: isExporting, mutate: exportMatches },
    matchCount,
    progress,
  } = useExportMatches();

  const { data: queryValidationResult } = useQueryValidationResult();
  const disabled =
    selectedCorpusNames.length === 0 ||
    aqlQuery === '' ||
    queryValidationResult?.type === 'invalid' ||
    queryValidationResult?.type === 'indeterminate';

  return isExporting ? (
    <div>
      <p className="mb-1">
        {matchCount === undefined
          ? 'Searching ...'
          : `Exporting ${matchCount} match${matchCount === 1 ? '' : 'es'} ...`}
      </p>
      <ProgressPercent value={progress} />
    </div>
  ) : (
    <Button
      className="w-full mt-1"
      disabled={disabled}
      onClick={async () => {
        const outputFile = await save();
        if (outputFile !== null) {
          exportMatches(
            {
              corpusNames: selectedCorpusNames,
              aqlQuery,
              queryLanguage,
              outputFile,
            },
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
                        <Folder className="w-4 h-4 mr-2" />
                        Open folder
                      </Button>

                      <Button
                        className="px-0"
                        onClick={() => open(outputFile)}
                        variant="link"
                      >
                        <File className="w-4 h-4 mr-2" />
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
