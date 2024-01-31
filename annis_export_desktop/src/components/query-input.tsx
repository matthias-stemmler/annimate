import { useClientState } from '@/lib/client-state';
import { useQueryValidationResult } from '@/lib/queries';
import { FC } from 'react';
import { Textarea } from './ui/textarea';

export const QueryInput: FC = () => {
  const { aqlQuery, selectedCorpusNames, setAqlQuery } = useClientState();
  const validationResult = useQueryValidationResult(
    selectedCorpusNames,
    aqlQuery,
  );

  console.log(validationResult);

  return (
    <Textarea
      className="font-mono"
      onChange={(event) => setAqlQuery(event.target.value)}
      value={aqlQuery}
    />
  );
};
