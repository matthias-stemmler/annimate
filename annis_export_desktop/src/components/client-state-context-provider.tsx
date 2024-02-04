import { QueryLanguage } from '@/lib/api';
import { ClientStateContext } from '@/lib/client-state';
import { useCorpusNames } from '@/lib/queries';
import { FC, PropsWithChildren, useCallback, useState } from 'react';

export const ClientStateContextProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { data: corpusNames } = useCorpusNames();

  const [aqlQuery, setAqlQuery] = useState<string>('');
  const [queryLanguage, setQueryLanguage] = useState<QueryLanguage>('AQL');
  const [selectedCorpusNames, setSelectedCorpusNames] = useState<string[]>([]);

  const toggleAllCorporaSelected = useCallback(() => {
    setSelectedCorpusNames((selectedCorpusNames) =>
      (corpusNames ?? []).every((c) => selectedCorpusNames.includes(c))
        ? []
        : corpusNames ?? [],
    );
  }, [corpusNames]);

  const toggleCorpusSelected = useCallback(
    (corpusName: string) => {
      setSelectedCorpusNames((selectedCorpusNames) =>
        (corpusNames ?? []).filter(
          (c) => selectedCorpusNames.includes(c) !== (c === corpusName),
        ),
      );
    },
    [corpusNames],
  );

  const value = {
    aqlQuery,
    queryLanguage,
    selectedCorpusNames: (corpusNames ?? [])?.filter((c) =>
      selectedCorpusNames.includes(c),
    ),

    setAqlQuery,
    setQueryLanguage,
    toggleAllCorporaSelected,
    toggleCorpusSelected,
  };

  return <ClientStateContext.Provider children={children} value={value} />;
};
