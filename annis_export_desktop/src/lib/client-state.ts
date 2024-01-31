import { createContext, useContext } from 'react';

export type ClientStateContextValue = {
  aqlQuery: string;
  selectedCorpusNames: string[];

  setAqlQuery: (aqlQuery: string) => void;
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
