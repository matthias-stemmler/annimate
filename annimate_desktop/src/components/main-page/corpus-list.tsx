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
  useCorpusNamesInSelectedSet,
  useCorpusSets,
  useSelectedCorpusNamesInSelectedSet,
  useSelectedCorpusSet,
  useSetSelectedCorpusSet,
  useToggleAllCorporaInSelectedSet,
  useToggleCorpus,
} from '@/lib/store';
import { Settings } from 'lucide-react';
import { FC } from 'react';
import { useNavigate } from 'react-router';

export const CorpusList: FC = () => {
  const isExporting = useIsExporting();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <CorpusSetSelect />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled={isExporting}
              onClick={() => {
                navigate('/manage', { replace: true });
              }}
              variant="ghost"
            >
              <Settings className="h-4 w-4" />
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
  const selectedCorpusSet = useSelectedCorpusSet();
  const setSelectedCorpusSet = useSetSelectedCorpusSet();

  const { data: corpusSets, error, isPending } = useCorpusSets();
  const isExporting = useIsExporting();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error.message}`);
  }

  return (
    <Select
      disabled={isExporting}
      loading={isPending}
      onChange={(value) => setSelectedCorpusSet(value.slice(1))}
      options={[
        {
          caption: <span className="italic">All corpora</span>,
          value: ':',
        },
        ...(corpusSets?.map((s) => ({
          caption: s,
          value: `:${s}`,
        })) ?? []),
      ]}
      value={`:${selectedCorpusSet}`}
    />
  );
};

const CorpusNamesSelect: FC = () => {
  const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();
  const toggleCorpus = useToggleCorpus();
  const toggleAllCorpora = useToggleAllCorporaInSelectedSet();

  const { data: corpusNames, error, isPending } = useCorpusNamesInSelectedSet();
  const isExporting = useIsExporting();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error.message}`);
  }

  if (isPending) {
    return <Spinner />;
  }

  return corpusNames.length === 0 ? (
    <div className="mt-4 text-center text-muted-foreground">
      <p>No corpora available</p>
      <p>
        Import corpora by clicking on the{' '}
        <Settings className="inline h-4 w-5 translate-y-0.5 align-baseline" />{' '}
        button
      </p>
    </div>
  ) : (
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
