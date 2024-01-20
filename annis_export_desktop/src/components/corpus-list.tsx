import { SelectList } from '@/components/ui/custom/select-list';
import { Spinner } from '@/components/ui/custom/spinner';
import { useCorpusNames } from '@/lib/queries';
import { FC, useState } from 'react';

export const CorpusList: FC = () => {
  const { data: corpusNames, error, isPending } = useCorpusNames();
  const [selectedCorpusNames, setSelectedCorpusNames] = useState<string[]>([]);

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
      onClick={(corpusName) =>
        setSelectedCorpusNames((cs) =>
          cs.includes(corpusName)
            ? cs.filter((c) => c !== corpusName)
            : [...cs, corpusName],
        )
      }
      onClickAll={() =>
        setSelectedCorpusNames((cs) =>
          cs.length === corpusNames.length ? [] : corpusNames,
        )
      }
    />
  );
};
