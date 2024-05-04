import { ImportDialog } from '@/components/dialogs/import-dialog';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fileOpen } from '@/lib/api';
import { OpenDialogOptions } from '@/lib/api-types';
import { useImportCorpora } from '@/lib/store';
import { File, Folder, FolderInput } from 'lucide-react';
import { useState } from 'react';

export const ImportTrigger = () => {
  const {
    mutation: { mutate: importCorpora },
    corporaStatus,
    messages,
    result,
  } = useImportCorpora();
  const [dialogOpen, setDialogOpen] = useState(false);

  const importCorporaFromDialog = async (options: OpenDialogOptions) => {
    const pathsRaw = await fileOpen(options);

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
            <FolderInput className="h-4 w-4 mr-2" />
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
            <File className="h-4 w-4 mr-2" /> From files (GraphML, multiple from
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
            <Folder className="h-4 w-4 mr-2" /> From folders (relANNIS,
            multiple)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen}>
        <ImportDialog
          key={+dialogOpen}
          corporaStatus={corporaStatus}
          messages={messages}
          onConfirm={(addToSet) => {
            console.log({ addToSet });
            setDialogOpen(false);
          }}
          result={result}
        />
      </Dialog>
    </>
  );
};
