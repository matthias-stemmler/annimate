import { Spinner } from '@/components/ui/custom/spinner';
import { useCorpusNames } from '@/lib/queries';
import { FC } from 'react';

export const CorpusSelect: FC = () => {
  const { data: corpusNames, error, isPending } = useCorpusNames();

  if (error !== null) {
    throw new Error(`Failed to load corpora: ${error}`);
  }

  if (isPending) {
    return <Spinner />;
  }

  return (
    <ul>
      {corpusNames.map((name: string) => (
        <li>{name}</li>
      ))}
    </ul>
  );
};
