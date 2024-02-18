import { QueryLanguage } from '@/lib/api';
import {
  ExportColumnItem,
  clientStateReducer,
  initialClientState,
} from '@/lib/client-state';
import { useDebounce } from '@/lib/hooks';
import { useCorpusNames } from '@/lib/queries';
import { createContext, useContext, useReducer } from 'react';

export type ClientStateContextValue = {
  aqlQuery: {
    value: string;
    debouncedValue: string;
  };
  exportColumns: ExportColumnItem[];
  queryLanguage: QueryLanguage;
  selectedCorpusNames: string[];

  removeExportColumn: (id: number) => void;
  reorderExportColumns: (
    reorder: (exportColumns: ExportColumnItem[]) => ExportColumnItem[],
  ) => void;
  setAqlQuery: (aqlQuery: string) => void;
  setQueryLanguage: (queryLanguage: QueryLanguage) => void;
  toggleAllCorpora: () => void;
  toggleCorpus: (corpusName: string) => void;
  unremoveExportColumn: (id: number) => void;
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
    exportColumns: clientState.exportColumns.filter(
      (c) => c.removalIndex === undefined,
    ),
    queryLanguage: clientState.queryLanguage,
    selectedCorpusNames: clientState.selectedCorpusNames,

    removeExportColumn: (id: number) =>
      dispatch({ type: 'export_column_removed', id }),
    reorderExportColumns: (
      reorder: (exportColumns: ExportColumnItem[]) => ExportColumnItem[],
    ) => dispatch({ type: 'export_columns_reordered', reorder }),
    setAqlQuery: (aqlQuery: string) =>
      dispatch({ type: 'aql_query_updated', aqlQuery }),
    setQueryLanguage: (queryLanguage: QueryLanguage) =>
      dispatch({ type: 'query_language_updated', queryLanguage }),
    toggleAllCorpora: () =>
      dispatch({ type: 'corpus_all_toggled', corpusNames: corpusNames ?? [] }),
    toggleCorpus: (corpusName: string) =>
      dispatch({
        type: 'corpus_toggled',
        corpusName,
        corpusNames: corpusNames ?? [],
      }),
    unremoveExportColumn: (id: number) =>
      dispatch({ type: 'export_column_unremoved', id }),
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
