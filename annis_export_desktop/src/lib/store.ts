import {
  AnnoKey,
  ExportColumn,
  ExportColumnData,
  ExportColumnType,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryValidationResult,
} from '@/lib/api-types';
import { useExportMatchesMutation } from '@/lib/mutations';
import {
  useCorpusNamesQuery,
  useExportableAnnoKeysQuery,
  useGetCorpusNamesQueryData,
  useGetExportableAnnoKeysQueryData,
  useQueryValidationResultQuery,
} from '@/lib/queries';
import { filterEligible } from '@/lib/utils';
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

const createExportColumn = (type: ExportColumnType): ExportColumn => {
  switch (type) {
    case 'number':
      return { type: 'number' };

    case 'anno_corpus':
      return {
        type: 'anno_corpus',
        annoKey: undefined,
      };

    case 'anno_document':
      return {
        type: 'anno_document',
        annoKey: undefined,
      };

    case 'anno_match':
      return {
        type: 'anno_match',
        annoKey: undefined,
      };

    case 'match_in_context':
      return { type: 'match_in_context' };
  }
};

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

const useGetState = (): StoreApi<State>['getState'] =>
  useStoreFromContext().getState;

const useSetState = (): StoreApi<State>['setState'] =>
  useStoreFromContext().setState;

// STATE GET

export const useSelectedCorpusNames = (): string[] => {
  const { data: corpusNames } = useCorpusNamesQuery();
  const selectedCorpusNames = useSelector((state) => state.selectedCorpusNames);
  return toSelectedCorpusNames(corpusNames, selectedCorpusNames);
};

export const useGetSelectedCorpusNames = (): (() => Promise<string[]>) => {
  const getCorpusNamesQueryData = useGetCorpusNamesQueryData();
  const getState = useGetState();

  return async () => {
    const corpusNames = await getCorpusNamesQueryData();
    const { selectedCorpusNames } = getState();
    return toSelectedCorpusNames(corpusNames, selectedCorpusNames);
  };
};

const toSelectedCorpusNames = (
  corpusNames: string[] | undefined,
  selectedCorpusNames: string[],
): string[] =>
  (corpusNames ?? []).filter((c) => selectedCorpusNames.includes(c));

export const useAqlQuery = (): string => useSelector((state) => state.aqlQuery);

export const useGetAqlQuery = (): (() => string) => {
  const getState = useGetState();
  return () => getState().aqlQuery;
};

export const useQueryLanguage = (): QueryLanguage =>
  useSelector((state) => state.queryLanguage);

export const useGetQueryLanguage = (): (() => QueryLanguage) => {
  const getState = useGetState();
  return () => getState().queryLanguage;
};

export const useExportColumnItems = (): ExportColumnItem[] => {
  const exportableAnnoKeys = useExportableAnnoKeys();
  const exportColumns = useSelector((state) => state.exportColumns);
  return toExportColumns(exportableAnnoKeys?.data, exportColumns);
};

export const useGetExportColumns = (): (() => Promise<ExportColumn[]>) => {
  const getSelectedCorpusNames = useGetSelectedCorpusNames();
  const getExportableAnnoKeysQueryData = useGetExportableAnnoKeysQueryData();
  const getState = useGetState();

  return async () => {
    const exportableAnnoKeys = await getExportableAnnoKeysQueryData({
      corpusNames: await getSelectedCorpusNames(),
    });
    const { exportColumns } = getState();
    return toExportColumns(exportableAnnoKeys, exportColumns);
  };
};

const toExportColumns = (
  exportableAnnoKeys: ExportableAnnoKeys | undefined,
  exportColumns: ExportColumnItem[],
): ExportColumnItem[] =>
  exportColumns
    .filter((c) => c.removalIndex === undefined)
    .map((column) => {
      switch (column.type) {
        case 'anno_corpus':
          return {
            ...column,
            annoKey: filterEligibleAnnoKey(
              exportableAnnoKeys?.corpus,
              column.annoKey,
            ),
          };

        case 'anno_document':
          return {
            ...column,
            annoKey: filterEligibleAnnoKey(
              exportableAnnoKeys?.doc,
              column.annoKey,
            ),
          };

        case 'anno_match':
          return {
            ...column,
            annoKey: filterEligibleAnnoKey(
              exportableAnnoKeys?.node,
              column.annoKey,
            ),
          };

        default:
          return column;
      }
    });

const filterEligibleAnnoKey = (
  eligibleAnnoKeys: ExportableAnnoKey[] | undefined,
  annoKey: AnnoKey | undefined,
): AnnoKey | undefined =>
  filterEligible(
    eligibleAnnoKeys,
    annoKey,
    (e, a) => e.annoKey.ns === a.ns && e.annoKey.name === a.name,
  );

export const useCanExport = (): boolean => {
  const selectedCorpusNames = useSelectedCorpusNames();
  const aqlQuery = useAqlQuery();
  const { data: queryValidationResult } = useQueryValidationResult();
  const exportColumns = useExportColumnItems();

  return (
    selectedCorpusNames.length > 0 &&
    aqlQuery !== '' &&
    (queryValidationResult === undefined ||
      queryValidationResult.type === 'valid') &&
    exportColumns.length > 0 &&
    exportColumns.every(isExportColumnValid)
  );
};

const isExportColumnValid = (exportColumn: ExportColumn): boolean => {
  switch (exportColumn.type) {
    case 'anno_corpus':
    case 'anno_document':
    case 'anno_match':
      return exportColumn.annoKey !== undefined;

    default:
      return true;
  }
};

// STATE SET

export const useToggleCorpus = (): ((corpusName: string) => Promise<void>) => {
  const getCorpusNamesQueryData = useGetCorpusNamesQueryData();
  const setState = useSetState();

  return async (corpusName: string) => {
    const corpusNames = await getCorpusNamesQueryData();
    return setState((state) => ({
      selectedCorpusNames: corpusNames.filter(
        (c) => state.selectedCorpusNames.includes(c) !== (c === corpusName),
      ),
    }));
  };
};

export const useToggleAllCorpora = (): (() => Promise<void>) => {
  const getCorpusNamesQueryData = useGetCorpusNamesQueryData();
  const setState = useSetState();

  return async () => {
    const corpusNames = await getCorpusNamesQueryData();
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

export const useAddExportColumn = (): ((type: ExportColumnType) => void) => {
  const setState = useSetState();

  return (type: ExportColumnType) => {
    setState((state) => {
      const id = (state.exportColumnsMaxId + 1) % Number.MAX_SAFE_INTEGER;
      const newExportColumn = { id, ...createExportColumn(type) };
      return {
        exportColumns: [...state.exportColumns, newExportColumn],
        exportColumnsMaxId: id,
      };
    });
  };
};

export const useUpdateExportColumn = <T extends ExportColumnType>(): ((
  id: number,
  exportColumn: Partial<ExportColumnData<T>>,
) => void) => {
  const setState = useSetState();

  return (id: number, exportColumn: Partial<ExportColumnData<T>>) => {
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

export const useCorpusAnnoKeys = (): UseQueryResult<ExportableAnnoKey[]> =>
  useSelectedExportableAnnoKeys((e) => e.corpus);

export const useDocAnnoKeys = (): UseQueryResult<ExportableAnnoKey[]> =>
  useSelectedExportableAnnoKeys((e) => e.doc);

export const useNodeAnnoKeys = (): UseQueryResult<ExportableAnnoKey[]> =>
  useSelectedExportableAnnoKeys((e) => e.node);

export const useExportableAnnoKeys = (): UseQueryResult<ExportableAnnoKeys> =>
  useSelectedExportableAnnoKeys((e) => e);

const useSelectedExportableAnnoKeys = <T>(
  select: (exportableAnnoKeys: ExportableAnnoKeys) => T,
): UseQueryResult<T> => {
  const selectedCorpusNames = useSelectedCorpusNames();

  return useExportableAnnoKeysQuery(
    {
      corpusNames: selectedCorpusNames,
    },
    select,
  );
};

// MUTATIONS

export const useExportMatches = () => {
  const getSelectedCorpusNames = useGetSelectedCorpusNames();
  const getAqlQuery = useGetAqlQuery();
  const getQueryLanguage = useGetQueryLanguage();
  const getExportColumns = useGetExportColumns();

  return useExportMatchesMutation(async () => ({
    corpusNames: await getSelectedCorpusNames(),
    aqlQuery: getAqlQuery(),
    queryLanguage: getQueryLanguage(),
    exportColumns: await getExportColumns(),
  }));
};

export { useIsExporting } from '@/lib/mutations';
