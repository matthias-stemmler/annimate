import { CorporaSection } from '@/components/manage-page/corpora-section';
import { ImportTrigger } from '@/components/manage-page/import-trigger';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowLeft } from 'lucide-react';
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

        <ImportTrigger onImportedIntoCorpusSet={setSelectedCorpusSet} />
      </header>

      <CorporaSection
        onSelectCorpusSet={setSelectedCorpusSet}
        selectedCorpusSet={selectedCorpusSet}
      />
    </div>
  );
};
