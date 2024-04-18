import { CorporaSection } from '@/components/manage-page/corpora-section';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { fileOpen } from '@/lib/api';
import { ArrowLeft, File, Folder, FolderInput } from 'lucide-react';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

export const ManagePage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <header className="h-10 my-3 relative flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="absolute left-3"
              onClick={() => {
                navigate('/', { replace: true });
              }}
              variant="ghost"
            >
              <ArrowLeft />
            </Button>
          </TooltipTrigger>

          <TooltipContent>Back</TooltipContent>
        </Tooltip>

        <h1 className="text-lg font-semibold">Manage corpora</h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="absolute right-3">
              <FolderInput className="h-4 w-4 mr-2" />
              Import corpora
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                fileOpen({
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
                });
              }}
            >
              <File className="h-4 w-4 mr-2" /> From files (GraphML, multiple
              from ZIP)
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                fileOpen({
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
      </header>

      <CorporaSection />
    </div>
  );
};
