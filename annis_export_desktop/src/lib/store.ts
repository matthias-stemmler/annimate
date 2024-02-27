import {
  ExportColumn,
  ExportColumnType,
  QueryLanguage,
  QueryValidationResult,
} from '@/lib/api';
import { useExportMatchesMutation } from '@/lib/mutations';
import {
  useCorpusNamesQuery,
  useGetCorpusNamesQueryData,
  useQueryValidationResultQuery,
} from '@/lib/queries';
import { UseQueryResult } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';

const MAX_REMOVED_COLUMNS = 3;

export type ExportColumnItem = ExportColumn & {
  id: number;
  removalIndex?: number;
};

export type State = {
  selectedCorpusNames: string[];

  aqlQuery: string;
  aqlQueryDebounced: string;
  queryLanguage: QueryLanguage;

  exportColumns: ExportColumnItem[];
  exportColumnsMaxId: number;
};

export const StoreContext = createContext<StoreApi<State> | undefined>(
  undefined,
);

export const createStoreForContext = (): StoreApi<State> =>
  createStore<State>()(() => ({
    selectedCorpusNames: [],

    aqlQuery: '',
    aqlQueryDebounced: '',
    queryLanguage: 'AQL',

    exportColumns: [],
    exportColumnsMaxId: 0,
  }));

const useStoreFromContext = (): StoreApi<State> => {
  const store = useContext(StoreContext);
  if (store === undefined) {
    throw new Error('Missing store');
  }
  return store;
};

const useSelector = <U>(
  selector: Parameters<typeof useStore<StoreApi<State>, U>>[1],
): U => useStore(useStoreFromContext(), selector);

const useSetState = (): StoreApi<State>['setState'] =>
  useStoreFromContext().setState;

// STATE GET

export const useSelectedCorpusNames = (): string[] => {
  const { data: corpusNames } = useCorpusNamesQuery();
  const selectedCorpusNames = useSelector((state) => state.selectedCorpusNames);
  return (corpusNames ?? []).filter((c) => selectedCorpusNames.includes(c));
};

export const useAqlQuery = (): string => useSelector((state) => state.aqlQuery);

export const useQueryLanguage = (): QueryLanguage =>
  useSelector((state) => state.queryLanguage);

export const useExportColumns = (): ExportColumnItem[] => {
  const exportColumns = useSelector((state) => state.exportColumns);
  return exportColumns.filter((c) => c.removalIndex === undefined);
};

export const useCanExport = (): boolean => {
  const selectedCorpusNames = useSelectedCorpusNames();
  const aqlQuery = useAqlQuery();
  const { data: queryValidationResult } = useQueryValidationResult();

  return (
    selectedCorpusNames.length > 0 &&
    aqlQuery !== '' &&
    (queryValidationResult === undefined ||
      queryValidationResult.type === 'valid')
  );
};

// STATE SET

export const useToggleCorpus = (): ((corpusName: string) => void) => {
  const getCorpusNamesQueryData = useGetCorpusNamesQueryData();
  const setState = useSetState();

  return (corpusName: string) => {
    const corpusNames = getCorpusNamesQueryData() ?? [];
    return setState((state) => ({
      selectedCorpusNames: corpusNames.filter(
        (c) => state.selectedCorpusNames.includes(c) !== (c === corpusName),
      ),
    }));
  };
};

export const useToggleAllCorpora = (): (() => void) => {
  const getCorpusNamesQueryData = useGetCorpusNamesQueryData();
  const setState = useSetState();

  return () => {
    const corpusNames = getCorpusNamesQueryData() ?? [];
    setState((state) => ({
      selectedCorpusNames: corpusNames.every((c) =>
        state.selectedCorpusNames.includes(c),
      )
        ? []
        : corpusNames,
    }));
  };
};

let aqlQueryDebounceTimeout: NodeJS.Timeout | undefined;

export const useSetAqlQuery = (): ((aqlQuery: string) => void) => {
  const setState = useSetState();

  return (aqlQuery: string) => {
    setState(() => ({
      aqlQuery,
    }));

    if (aqlQueryDebounceTimeout !== undefined) {
      clearTimeout(aqlQueryDebounceTimeout);
    }

    if (aqlQuery === '') {
      setState(() => ({
        aqlQueryDebounced: '',
      }));
    } else {
      aqlQueryDebounceTimeout = setTimeout(() => {
        setState(() => ({
          aqlQueryDebounced: aqlQuery,
        }));
      }, 300);
    }
  };
};

export const useSetQueryLanguage = (): ((
  queryLanguage: QueryLanguage,
) => void) => {
  const setState = useSetState();
  return (queryLanguage: QueryLanguage) => setState({ queryLanguage });
};

export const useAddExportColumn = (): ((
  columnType: ExportColumnType,
) => void) => {
  const setState = useSetState();

  return (columnType: ExportColumnType) => {
    setState((state) => {
      const id = (state.exportColumnsMaxId + 1) % Number.MAX_SAFE_INTEGER;
      const newExportColumn = { id, type: columnType };
      return {
        exportColumns: [...state.exportColumns, newExportColumn],
        exportColumnsMaxId: id,
      };
    });
  };
};

export const useUpdateExportColumn = (): ((
  id: number,
  exportColumn: ExportColumn,
) => void) => {
  const setState = useSetState();

  return (id: number, exportColumn: ExportColumn) => {
    setState((state) => ({
      exportColumns: state.exportColumns.map((c) =>
        c.id === id ? { ...c, ...exportColumn } : c,
      ),
    }));
  };
};

export const useReorderExportColumns = (): ((
  reorder: (exportColumns: ExportColumnItem[]) => ExportColumnItem[],
) => void) => {
  const setState = useSetState();

  return (
    reorder: (exportColumns: ExportColumnItem[]) => ExportColumnItem[],
  ) => {
    setState((state) => ({
      exportColumns: reorder(state.exportColumns),
    }));
  };
};

export const useRemoveExportColumn = (): ((id: number) => void) => {
  const setState = useSetState();

  return (id: number) => {
    setState((state) => {
      const removedColumns = state.exportColumns.filter(
        (c) => c.removalIndex !== undefined,
      );
      removedColumns.sort((c1, c2) => c1.removalIndex! - c2.removalIndex!);
      const nextRemovalIndex =
        removedColumns.length === 0
          ? 1
          : (removedColumns[removedColumns.length - 1].removalIndex! + 1) %
            Number.MAX_SAFE_INTEGER;
      const idsToRemovePermanently =
        removedColumns.length + 1 > MAX_REMOVED_COLUMNS
          ? removedColumns
              .slice(0, removedColumns.length + 1 - MAX_REMOVED_COLUMNS)
              .map((c) => c.id)
          : [];

      return {
        exportColumns: state.exportColumns
          .filter((c) => !idsToRemovePermanently.includes(c.id))
          .map((column) => ({
            ...column,
            removalIndex:
              column.id === id ? nextRemovalIndex : column.removalIndex,
          })),
      };
    });
  };
};

export const useUnremoveExportColumn = (): ((id: number) => void) => {
  const setState = useSetState();

  return (id: number) => {
    setState((state) => ({
      exportColumns: state.exportColumns.map((c) => ({
        ...c,
        removalIndex: c.id === id ? undefined : c.removalIndex,
      })),
    }));
  };
};

// QUERIES

export const useCorpusNames = (): UseQueryResult<string[]> =>
  useCorpusNamesQuery();

export const useQueryValidationResult =
  (): UseQueryResult<QueryValidationResult> => {
    const selectedCorpusNames = useSelectedCorpusNames();
    const aqlQueryDebounced = useSelector((state) => state.aqlQueryDebounced);
    const queryLanguage = useQueryLanguage();

    return useQueryValidationResultQuery({
      corpusNames: selectedCorpusNames,
      aqlQuery: aqlQueryDebounced,
      queryLanguage,
    });
  };

// MUTATIONS

export const useExportMatches = () => {
  const selectedCorpusNames = useSelectedCorpusNames();
  const aqlQuery = useAqlQuery();
  const queryLanguage = useQueryLanguage();

  return useExportMatchesMutation({
    corpusNames: selectedCorpusNames,
    aqlQuery,
    queryLanguage,
  });
};

export { useIsExporting } from '@/lib/mutations';
