import {
  AnnoKey,
  Corpora,
  Corpus,
  ExportColumn,
  ExportColumnData,
  ExportColumnType,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryNode,
  QueryNodeRef,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import { useExportMatchesMutation } from '@/lib/mutations';
import {
  useCorporaQuery,
  useExportableAnnoKeysQuery,
  useGetCorporaQueryData,
  useGetExportableAnnoKeysQueryData,
  useGetQueryNodesQueryData,
  useGetSegmentationsQueryData,
  useQueryNodesQuery,
  useQueryValidationResultQuery,
  useSegmentationsQuery,
} from '@/lib/queries';
import { findEligibleQueryNodeRefIndex } from '@/lib/query-node-utils';
import { filterEligible } from '@/lib/utils';
import { UseQueryResult } from '@tanstack/react-query';
import { createContext, useCallback, useContext } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';

const MAX_REMOVED_COLUMNS = 3;

export type ExportColumnItem = ExportColumn & {
  id: number;
  removalIndex?: number;
};

export type ExportColumnUpdate =
  | {
      type: 'anno_corpus';
      payload: {
        type: 'update_anno_key';
        annoKey: AnnoKey;
      };
    }
  | {
      type: 'anno_document';
      payload: {
        type: 'update_anno_key';
        annoKey: AnnoKey;
      };
    }
  | {
      type: 'anno_match';
      payload:
        | {
            type: 'update_anno_key';
            annoKey: AnnoKey;
          }
        | {
            type: 'update_node_ref';
            nodeRef: QueryNodeRef;
          };
    }
  | {
      type: 'match_in_context';
      payload:
        | {
            type: 'update_context';
            context: number;
          }
        | {
            type: 'update_context_right_override';
            contextRightOverride: number | undefined;
          }
        | {
            type: 'toggle_primary_node_ref';
            nodeRef: QueryNodeRef;
          }
        | {
            type: 'reorder_primary_node_refs';
            reorder: (primaryNodeRefs: QueryNodeRef[]) => QueryNodeRef[];
          }
        | {
            type: 'update_segmentation';
            segmentation: string | undefined;
          };
    };

export type State = {
  selectedCorpusSet: string;
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
    selectedCorpusSet: '',
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
        nodeRef: undefined,
      };

    case 'match_in_context':
      return {
        type: 'match_in_context',
        context: 20,
        contextRightOverride: undefined,
        primaryNodeRefs: [],
        secondaryNodeRefs: [],
        segmentation: '',
      };
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

export const useSelectedCorpusSet = (): string => {
  const { data: corpusSets } = useCorporaQuery(({ sets }) => sets);
  const selectedCorpusSet = useSelector((state) => state.selectedCorpusSet);
  return toSelectedCorpusSet(corpusSets, selectedCorpusSet);
};

export const useGetSelectedCorpusSet = (): (() => Promise<string>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const getState = useGetState();

  return async () => {
    const { sets } = await getCorporaQueryData();
    const { selectedCorpusSet } = getState();
    return toSelectedCorpusSet(sets, selectedCorpusSet);
  };
};

const toSelectedCorpusSet = (
  corpusSets: string[] | undefined,
  selectedCorpusSet: string,
): string =>
  (corpusSets ?? []).includes(selectedCorpusSet) ? selectedCorpusSet : '';

export const useSelectedCorpusNamesInSelectedSet = (): string[] => {
  const { data: corpora } = useCorporaQuery(({ corpora }) => corpora);

  const selectedCorpusSet = useSelectedCorpusSet();
  const selectedCorpusNames = useSelector((state) => state.selectedCorpusNames);

  return toSelectedCorpusNamesInSet(
    corpora,
    selectedCorpusSet,
    selectedCorpusNames,
  );
};

export const useGetSelectedCorpusNamesInSelectedSet = (): (() => Promise<
  string[]
>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const getState = useGetState();

  return async () => {
    const { corpora } = await getCorporaQueryData();
    const { selectedCorpusNames, selectedCorpusSet } = getState();

    return toSelectedCorpusNamesInSet(
      corpora,
      selectedCorpusSet,
      selectedCorpusNames,
    );
  };
};

const toSelectedCorpusNamesInSet = (
  corpora: Corpus[] | undefined,
  corpusSet: string,
  selectedCorpusNames: string[],
): string[] =>
  (corpora ?? [])
    .filter(
      ({ name, includedInSets }) =>
        (corpusSet === '' || includedInSets.includes(corpusSet)) &&
        selectedCorpusNames.includes(name),
    )
    .map((c) => c.name);

export const useAqlQuery = (): string => useSelector((state) => state.aqlQuery);

export const useGetAqlQuery = (): (() => string) => {
  const getState = useGetState();
  return () => getState().aqlQuery;
};

const useGetAqlQueryDebounced = (): (() => string) => {
  const getState = useGetState();
  return () => getState().aqlQueryDebounced;
};

export const useQueryLanguage = (): QueryLanguage =>
  useSelector((state) => state.queryLanguage);

export const useGetQueryLanguage = (): (() => QueryLanguage) => {
  const getState = useGetState();
  return () => getState().queryLanguage;
};

export const useExportColumnItems = (): ExportColumnItem[] => {
  const exportableAnnoKeys = useExportableAnnoKeys();
  const queryNodes = useQueryNodes();
  const segmentations = useSegmentations();
  const exportColumns = useSelector((state) => state.exportColumns);

  return toExportColumns(
    exportableAnnoKeys.data,
    queryNodes.data,
    segmentations.data,
    exportColumns,
  );
};

export const useGetExportColumns = (): (() => Promise<ExportColumn[]>) => {
  const getSelectedCorpusNamesInSelectedSet =
    useGetSelectedCorpusNamesInSelectedSet();

  const getExportableAnnoKeysQueryData = useGetExportableAnnoKeysQueryData();
  const getSegmentationsQueryData = useGetSegmentationsQueryData();
  const getQueryNodes = useGetQueryNodes();

  const getState = useGetState();

  return async () => {
    const corpusNames = await getSelectedCorpusNamesInSelectedSet();
    const exportableAnnoKeys = await getExportableAnnoKeysQueryData({
      corpusNames,
    });
    const queryNodes = await getQueryNodes();
    const segmentations = await getSegmentationsQueryData({ corpusNames });
    const { exportColumns } = getState();
    return toExportColumns(
      exportableAnnoKeys,
      queryNodes,
      segmentations,
      exportColumns,
    );
  };
};

const useGetQueryNodes = (): (() => Promise<QueryNodesResult>) => {
  const getQueryNodesQueryData = useGetQueryNodesQueryData();
  const getAqlQueryDebounced = useGetAqlQueryDebounced();
  const getQueryLanguage = useGetQueryLanguage();

  return () =>
    getQueryNodesQueryData({
      aqlQuery: getAqlQueryDebounced(),
      queryLanguage: getQueryLanguage(),
    });
};

const toExportColumns = (
  exportableAnnoKeys: ExportableAnnoKeys | undefined,
  queryNodes: QueryNodesResult | undefined,
  segmentations: string[] | undefined,
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
            nodeRef: findEligibleQueryNodeRef(
              toNodeRefs(queryNodes),
              column.nodeRef,
            ),
          };

        case 'match_in_context': {
          const { primaryNodeRefs, secondaryNodeRefs } =
            distributeQueryNodeRefs(
              toNodeRefs(queryNodes),
              column.primaryNodeRefs,
              column.secondaryNodeRefs,
            );

          return {
            ...column,
            primaryNodeRefs,
            secondaryNodeRefs,
            segmentation: filterEligible(
              segmentations,
              column.segmentation,
              (a, b) => a === b,
            ),
          };
        }

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

const findEligibleQueryNodeRef = (
  nodeRefs: QueryNodeRef[],
  nodeRef: QueryNodeRef | undefined,
) => {
  if (nodeRef === undefined) {
    return undefined;
  }

  const nodeRefIndex = findEligibleQueryNodeRefIndex(nodeRefs, nodeRef);
  return nodeRefIndex === undefined ? undefined : nodeRefs[nodeRefIndex];
};

const distributeQueryNodeRefs = (
  nodeRefs: QueryNodeRef[],
  primaryNodeRefs: QueryNodeRef[],
  secondaryNodeRefs: QueryNodeRef[],
): { primaryNodeRefs: QueryNodeRef[]; secondaryNodeRefs: QueryNodeRef[] } => {
  const targetPrimaryNodeRefsWithPrio: [QueryNodeRef, number][] = [];
  const targetSecondaryNodeRefs: QueryNodeRef[] = [];

  for (const nodeRef of nodeRefs) {
    const primaryIndex = findEligibleQueryNodeRefIndex(
      primaryNodeRefs,
      nodeRef,
    );

    if (primaryIndex !== undefined) {
      targetPrimaryNodeRefsWithPrio.push([nodeRef, primaryIndex]);
    } else if (
      findEligibleQueryNodeRefIndex(secondaryNodeRefs, nodeRef) !== undefined
    ) {
      targetSecondaryNodeRefs.push(nodeRef);
    } else {
      targetPrimaryNodeRefsWithPrio.push([
        nodeRef,
        nodeRefs.length + nodeRef.index,
      ]);
    }
  }

  const targetPrimaryNodeRefs = targetPrimaryNodeRefsWithPrio
    .sort(([, i], [, j]) => i - j)
    .map(([n]) => n);

  return {
    primaryNodeRefs: targetPrimaryNodeRefs,
    secondaryNodeRefs: targetSecondaryNodeRefs,
  };
};

const toNodeRefs = (
  queryNodesResult: QueryNodesResult | undefined,
): QueryNodeRef[] => {
  const queryNodes: QueryNode[][] =
    queryNodesResult?.type === 'valid' ? queryNodesResult.nodes : [];
  return queryNodes.map((ns, index) => ({
    index,
    variables: ns.map((n) => n.variable),
  }));
};

export const useCanExport = (): boolean => {
  const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();
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
      return exportColumn.annoKey !== undefined;

    case 'anno_match':
      return (
        exportColumn.annoKey !== undefined && exportColumn.nodeRef !== undefined
      );

    case 'match_in_context':
      return (
        !isNaN(exportColumn.context) &&
        (exportColumn.contextRightOverride === undefined ||
          !isNaN(exportColumn.contextRightOverride)) &&
        exportColumn.segmentation !== undefined
      );

    default:
      return true;
  }
};

// STATE SET

export const useSetSelectedCorpusSet = (): ((corpusSet: string) => void) => {
  const setState = useSetState();

  return (corpusSet: string) =>
    setState({
      selectedCorpusSet: corpusSet,
    });
};

export const useToggleCorpus = (): ((corpusName: string) => Promise<void>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const setState = useSetState();

  return async (corpusName: string) => {
    const { corpora } = await getCorporaQueryData();

    return setState((state) => ({
      selectedCorpusNames: corpora
        .filter(
          ({ name }) =>
            state.selectedCorpusNames.includes(name) !== (name === corpusName),
        )
        .map((c) => c.name),
    }));
  };
};

export const useToggleAllCorporaInSelectedSet = (): (() => Promise<void>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const setState = useSetState();

  return async () => {
    const { corpora } = await getCorporaQueryData();

    setState((state) => {
      const isAllInSelectedSetSelected = corpora.every(
        ({ name, includedInSets }) => {
          const isInSelectedSet =
            state.selectedCorpusSet === '' ||
            includedInSets.includes(state.selectedCorpusSet);

          return !isInSelectedSet || state.selectedCorpusNames.includes(name);
        },
      );

      return {
        selectedCorpusNames: corpora
          .filter(({ name, includedInSets }) => {
            const isInSelectedSet =
              state.selectedCorpusSet === '' ||
              includedInSets.includes(state.selectedCorpusSet);
            const isSelected = state.selectedCorpusNames.includes(name);

            return isInSelectedSet ? !isAllInSelectedSetSelected : isSelected;
          })
          .map((c) => c.name),
      };
    });
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

export const useUpdateExportColumn = (): ((
  id: number,
  update: ExportColumnUpdate,
) => Promise<void>) => {
  const setState = useSetState();
  const getQueryNodes = useGetQueryNodes();

  const update = useCallback(
    <T extends ExportColumnType>(
      id: number,
      type: T,
      getUpdate: (c: ExportColumnData<T>) => Partial<ExportColumnData<T>>,
    ) =>
      setState((state) => ({
        exportColumns: state.exportColumns.map((c) =>
          c.id === id && c.type === type
            ? { ...c, ...getUpdate(c as unknown as ExportColumnData<T>) }
            : c,
        ),
      })),
    [setState],
  );

  return async (id: number, { type, payload }: ExportColumnUpdate) => {
    switch (payload.type) {
      case 'update_anno_key': {
        update(id, type, () => ({ annoKey: payload.annoKey }));
        return;
      }

      case 'update_node_ref': {
        update(id, type, () => ({ nodeRef: payload.nodeRef }));
        return;
      }

      case 'update_context': {
        update(id, type, () => ({ context: payload.context }));
        return;
      }

      case 'update_context_right_override': {
        update(id, type, () => ({
          contextRightOverride: payload.contextRightOverride,
        }));
        return;
      }

      case 'toggle_primary_node_ref': {
        if (type !== 'match_in_context') {
          return;
        }

        const queryNodes = await getQueryNodes();

        update(id, type, (c: ExportColumnData<'match_in_context'>) => {
          const { primaryNodeRefs, secondaryNodeRefs } =
            distributeQueryNodeRefs(
              toNodeRefs(queryNodes),
              c.primaryNodeRefs,
              c.secondaryNodeRefs,
            );

          const nodeRefToToggle = payload.nodeRef;

          const isPrimary = secondaryNodeRefs.every(
            (n) => n.index !== nodeRefToToggle.index,
          );

          return isPrimary
            ? {
                primaryNodeRefs: primaryNodeRefs.filter(
                  (n) => n.index !== nodeRefToToggle.index,
                ),
                secondaryNodeRefs: [...secondaryNodeRefs, nodeRefToToggle],
              }
            : {
                primaryNodeRefs: [...primaryNodeRefs, nodeRefToToggle],
                secondaryNodeRefs: secondaryNodeRefs.filter(
                  (n) => n.index !== nodeRefToToggle.index,
                ),
              };
        });

        return;
      }

      case 'reorder_primary_node_refs': {
        if (type !== 'match_in_context') {
          return;
        }

        const queryNodes = await getQueryNodes();

        update(id, type, (c: ExportColumnData<'match_in_context'>) => {
          const { primaryNodeRefs, secondaryNodeRefs } =
            distributeQueryNodeRefs(
              toNodeRefs(queryNodes),
              c.primaryNodeRefs,
              c.secondaryNodeRefs,
            );

          return {
            primaryNodeRefs: payload.reorder(primaryNodeRefs),
            secondaryNodeRefs,
          };
        });

        return;
      }

      case 'update_segmentation': {
        update(id, type, () => ({
          segmentation: payload.segmentation,
        }));
      }
    }
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

export const useCorpora = (): UseQueryResult<Corpora> =>
  useCorporaQuery((corpora) => corpora);

export const useCorpusNamesInSelectedSet = (): UseQueryResult<string[]> => {
  const selectedCorpusSet = useSelectedCorpusSet();

  return useCorporaQuery(({ corpora }) =>
    corpora
      .filter(
        ({ includedInSets }) =>
          selectedCorpusSet === '' ||
          includedInSets.includes(selectedCorpusSet),
      )
      .map((c) => c.name),
  );
};

export const useCorpusSets = (): UseQueryResult<string[]> =>
  useCorporaQuery(({ sets }) => sets);

export const useQueryNodes = (): UseQueryResult<QueryNodesResult> => {
  const aqlQueryDebounced = useSelector((state) => state.aqlQueryDebounced);
  const queryLanguage = useQueryLanguage();

  return useQueryNodesQuery({
    aqlQuery: aqlQueryDebounced,
    queryLanguage,
  });
};

export const useQueryValidationResult =
  (): UseQueryResult<QueryValidationResult> => {
    const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();
    const aqlQueryDebounced = useSelector((state) => state.aqlQueryDebounced);
    const queryLanguage = useQueryLanguage();

    return useQueryValidationResultQuery({
      corpusNames: selectedCorpusNames,
      aqlQuery: aqlQueryDebounced,
      queryLanguage,
    });
  };

export const useSegmentations = (): UseQueryResult<string[]> => {
  const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();

  return useSegmentationsQuery({
    corpusNames: selectedCorpusNames,
  });
};

export const useExportableAnnoKeys = (): UseQueryResult<ExportableAnnoKeys> => {
  const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();

  return useExportableAnnoKeysQuery({
    corpusNames: selectedCorpusNames,
  });
};

// MUTATIONS

export {
  useAddCorporaToSetMutation as useAddCorporaToSet,
  useCreateCorpusSetMutation as useCreateCorpusSet,
  useDeleteCorpusMutation as useDeleteCorpus,
  useImportCorporaMutation as useImportCorpora,
  useIsExporting,
  useRenameCorpusSetMutation as useRenameCorpusSet,
  useToggleCorpusInSetMutation as useToggleCorpusInSet,
} from '@/lib/mutations';

export const useExportMatches = () => {
  const getSelectedCorpusNamesInSelectedSet =
    useGetSelectedCorpusNamesInSelectedSet();
  const getAqlQuery = useGetAqlQuery();
  const getQueryLanguage = useGetQueryLanguage();
  const getExportColumns = useGetExportColumns();

  return useExportMatchesMutation(async () => ({
    corpusNames: await getSelectedCorpusNamesInSelectedSet(),
    aqlQuery: getAqlQuery(),
    queryLanguage: getQueryLanguage(),
    exportColumns: await getExportColumns(),
  }));
};
