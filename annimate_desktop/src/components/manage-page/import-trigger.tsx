import { ImportDialog } from '@/components/dialogs/import-dialog';
import { useDialogState } from '@/components/dialogs/use-dialog-state';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { open } from '@/lib/api';
import { OpenDialogOptions } from '@/lib/api-types';
import { useAddCorporaToSet, useImportCorpora } from '@/lib/store';
import { File, Folder, FolderInput } from 'lucide-react';
import { FC } from 'react';

export type ImportTriggerProps = {
  onImportedIntoCorpusSet?: (corpusSet: string | undefined) => void;
};

export const ImportTrigger: FC<ImportTriggerProps> = ({
  onImportedIntoCorpusSet,
}) => {
  const {
    mutation: { mutate: importCorpora, isPending },
    corporaStatus,
    messages,
    result,
    cancelRequested,
    requestCancel,
  } = useImportCorpora();

  const {
    mutation: { mutate: addCorporaToSet },
  } = useAddCorporaToSet();

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen, dialogKey] = useDialogState();

  const importCorporaFromDialog = async (options: OpenDialogOptions) => {
    const pathsRaw = await open(options);

    if (pathsRaw !== null) {
      importCorpora({ paths: Array.isArray(pathsRaw) ? pathsRaw : [pathsRaw] });
      setDialogOpen(true);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="absolute right-3">
            <FolderInput className="mr-2 size-4" />
            Import corpora
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() =>
              importCorporaFromDialog({
                filters: [
                  {
                    name: 'All supported types (*.graphml, *.zip)',
                    extensions: ['graphml', 'zip'],
                  },
                  {
                    name: 'GraphML (*.graphml)',
                    extensions: ['graphml'],
                  },
                  {
                    name: 'ZIP (*.zip)',
                    extensions: ['zip'],
                  },
                ],
                multiple: true,
                title: 'Import corpora from files',
              })
            }
          >
            <File className="mr-2 size-4" /> From files (GraphML, multiple from
            ZIP)
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              importCorporaFromDialog({
                directory: true,
                multiple: true,
                title: 'Import corpora from folders',
              });
            }}
          >
            <Folder className="mr-2 size-4" /> From folders (relANNIS, multiple)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen}>
        <ImportDialog
          key={dialogKey}
          cancelStatus={
            cancelRequested && isPending
              ? 'pending'
              : isPending
                ? 'enabled'
                : 'disabled'
          }
          corporaStatus={corporaStatus}
          messages={messages}
          onCancelRequested={requestCancel}
          onConfirm={(addToSet) => {
            if (addToSet !== undefined && result?.type === 'imported') {
              addCorporaToSet(
                {
                  corpusSet: addToSet,
                  corpusNames: result.corpusNames,
                },
                {
                  onSuccess: () => {
                    onImportedIntoCorpusSet?.(addToSet);
                  },
                  onError: (error: Error) => {
                    toast({
                      className: 'break-all',
                      description: error.message,
                      duration: 15000,
                      title: `Failed to add ${result.corpusNames.length === 1 ? 'imported corpus' : `${result.corpusNames.length} imported corpora`} to set`,
                      variant: 'destructive',
                    });
                  },
                },
              );
            }

            setDialogOpen(false);
          }}
          result={result}
        />
      </Dialog>
    </>
  );
};
