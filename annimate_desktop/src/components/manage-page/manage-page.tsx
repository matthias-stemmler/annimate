import { AllCorporaList } from '@/components/manage-page/all-corpora-list';
import { CorporaInSetList } from '@/components/manage-page/corpora-in-set-list';
import { CorpusSetList } from '@/components/manage-page/corpus-set-list';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowLeft, FolderInput } from 'lucide-react';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const ManagePage: FC = () => {
  const navigate = useNavigate();
  const [selectedCorpusSet, setSelectedCorpusSet] = useState<
    string | undefined
  >();

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

        <Button className="absolute right-3">
          <FolderInput className="h-4 w-4 mr-2" />
          Import corpora
        </Button>
      </header>

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel className="p-3" defaultSize={50} minSize={30}>
          <CorpusSetList
            onSelectCorpusSet={setSelectedCorpusSet}
            selectedCorpusSet={selectedCorpusSet}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel className="p-3" defaultSize={50} minSize={30}>
          {selectedCorpusSet === undefined ? (
            <AllCorporaList />
          ) : (
            <CorporaInSetList corpusSet={selectedCorpusSet} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
