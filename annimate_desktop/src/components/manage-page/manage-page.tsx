import { CorporaSection } from '@/components/manage-page/corpora-section';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowLeft, FolderInput } from 'lucide-react';
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

        <Button className="absolute right-3">
          <FolderInput className="h-4 w-4 mr-2" />
          Import corpora
        </Button>
      </header>

      <CorporaSection />
    </div>
  );
};
