import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/custom/select';
import { SelectList } from '@/components/ui/custom/select-list';
import { Spinner } from '@/components/ui/custom/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsExporting } from '@/lib/mutations';
import {
  useCorpusNames,
  useSelectedCorpusNames,
  useToggleAllCorpora,
  useToggleCorpus,
} from '@/lib/store';
import { Settings } from 'lucide-react';
import { FC } from 'react';

export const CorpusList: FC = () => {
  const isExporting = useIsExporting();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CorpusSetSelect />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled={isExporting} variant="ghost">
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>

          <TooltipContent>Manage corpora</TooltipContent>
        </Tooltip>
      </div>

      <CorpusNamesSelect />
    </div>
  );
};

const CorpusSetSelect: FC = () => {
  const corpusSetNames = ['a', 'b', 'c'];
  const isPending = false;

  const isExporting = useIsExporting();

  return (
    <Select
      disabled={isExporting}
      loading={isPending}
      options={[
        {
          caption: <span className="italic">All corpus sets</span>,
          value: ':',
        },
        ...(corpusSetNames?.map((s) => ({
          caption: s,
          value: `:${s}`,
        })) ?? []),
      ]}
    />
  );
};

const CorpusNamesSelect: FC = () => {
  const selectedCorpusNames = useSelectedCorpusNames();
  const toggleCorpus = useToggleCorpus();
  const toggleAllCorpora = useToggleAllCorpora();

  const { data: corpusNames, error, isPending } = useCorpusNames();
  const isExporting = useIsExporting();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error}`);
  }

  if (isPending) {
    return <Spinner />;
  }

  return (
    <SelectList
      disabled={isExporting}
      label="Corpora"
      onClick={toggleCorpus}
      onClickAll={toggleAllCorpora}
      selectedValues={selectedCorpusNames}
      renderValue={(corpusName) => corpusName}
      values={corpusNames}
    />
  );
};
