import { QueryLanguage } from '@/lib/api';
import { clientStateReducer, initialClientState } from '@/lib/client-state';
import { useDebounce } from '@/lib/hooks';
import { useCorpusNames } from '@/lib/queries';
import { createContext, useContext, useReducer } from 'react';

export type ClientStateContextValue = {
  aqlQuery: {
    value: string;
    debouncedValue: string;
  };
  queryLanguage: QueryLanguage;
  selectedCorpusNames: string[];

  setAqlQuery: (aqlQuery: string) => void;
  setQueryLanguage: (queryLanguage: QueryLanguage) => void;
  toggleAllCorpora: () => void;
  toggleCorpus: (corpusName: string) => void;
};

export const useClientStateContextValue = (): ClientStateContextValue => {
  const [clientState, dispatch] = useReducer(
    clientStateReducer,
    initialClientState,
  );

  const { data: corpusNames } = useCorpusNames();

  const aqlQueryDebounced = useDebounce(
    clientState.aqlQuery,
    300,
    clientState.aqlQuery !== '',
  );

  return {
    aqlQuery: {
      value: clientState.aqlQuery,
      debouncedValue: aqlQueryDebounced,
    },
    queryLanguage: clientState.queryLanguage,
    selectedCorpusNames: clientState.selectedCorpusNames,

    setAqlQuery: (aqlQuery: string) =>
      dispatch({ type: 'AQL_QUERY_UPDATED', aqlQuery }),
    setQueryLanguage: (queryLanguage: QueryLanguage) =>
      dispatch({ type: 'QUERY_LANGUAGE_UPDATED', queryLanguage }),
    toggleAllCorpora: () =>
      dispatch({ type: 'CORPUS_ALL_TOGGLED', corpusNames: corpusNames ?? [] }),
    toggleCorpus: (corpusName: string) =>
      dispatch({
        type: 'CORPUS_TOGGLED',
        corpusName,
        corpusNames: corpusNames ?? [],
      }),
  };
};

export const ClientStateContext = createContext<
  ClientStateContextValue | undefined
>(undefined);

export const useClientState = (): ClientStateContextValue => {
  const value = useContext(ClientStateContext);
  if (value === undefined) {
    throw new Error('Missing client state');
  }

  return value;
};
