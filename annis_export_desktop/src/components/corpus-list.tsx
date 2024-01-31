import { SelectList } from '@/components/ui/custom/select-list';
import { Spinner } from '@/components/ui/custom/spinner';
import { useClientState } from '@/lib/client-state';
import { useCorpusNames } from '@/lib/queries';
import { FC } from 'react';

export const CorpusList: FC = () => {
  const { data: corpusNames, error, isPending } = useCorpusNames();
  const {
    selectedCorpusNames,
    toggleCorpusSelected,
    toggleAllCorporaSelected,
  } = useClientState();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error}`);
  }

  if (isPending) {
    return <Spinner />;
  }

  return (
    <SelectList
      values={corpusNames}
      selectedValues={selectedCorpusNames}
      renderValue={(corpusName) => corpusName}
      onClick={toggleCorpusSelected}
      onClickAll={toggleAllCorporaSelected}
    />
  );
};
