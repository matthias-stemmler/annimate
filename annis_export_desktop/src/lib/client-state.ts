import { QueryLanguage } from '@/lib/api';
import { createContext, useContext } from 'react';

export type ClientStateContextValue = {
  aqlQuery: {
    value: string;
    debouncedValue: string;
  };
  queryLanguage: QueryLanguage;
  selectedCorpusNames: string[];

  setAqlQuery: (aqlQuery: string) => void;
  setQueryLanguage: (queryLanguage: QueryLanguage) => void;
  toggleAllCorporaSelected: () => void;
  toggleCorpusSelected: (corpusName: string) => void;
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
