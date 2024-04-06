import { SelectList } from '@/components/ui/custom/select-list';
import { Spinner } from '@/components/ui/custom/spinner';
import { useIsExporting } from '@/lib/mutations';
import {
  useCorpusNames,
  useSelectedCorpusNames,
  useToggleAllCorpora,
  useToggleCorpus,
} from '@/lib/store';
import { FC } from 'react';

export const CorpusList: FC = () => {
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
