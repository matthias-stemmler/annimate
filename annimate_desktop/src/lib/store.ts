import {
  AnnoKey,
  Corpora,
  Corpus,
  ExportColumn,
  ExportColumnData,
  ExportColumnType,
  ExportFormat,
  ExportSpec,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryNode,
  QueryNodeRef,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import {
  useDeleteCorpusMutation,
  useDeleteCorpusSetMutation,
  useExportMatchesMutation,
  useLoadProjectMutation,
  useRenameCorpusSetMutation,
  useSaveProjectMutation,
  useSetCorpusNamesToPreloadMutation,
} from '@/lib/mutations';
import {
  UseGetQueryDataOptions,
  useCorporaQuery,
  useExportableAnnoKeysQuery,
  useGetCorporaQueryData,
  useGetExportableAnnoKeysQueryData,
  useGetQueryNodesQueryData,
  useGetQueryValidationResultQueryData,
  useGetSegmentationsQueryData,
  useQueryNodesQuery,
  useQueryValidationResultQuery,
  useSegmentationsQuery,
} from '@/lib/queries';
import { findEligibleQueryNodeRefIndex } from '@/lib/query-node-utils';
import { UseSlowTrackingQueryResult } from '@/lib/slow-queries';
import { filterEligible } from '@/lib/utils';
import { UseQueryResult } from '@tanstack/react-query';
import { createContext, useCallback, useContext } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';

export const CONTEXT_MIN = 0;
export const CONTEXT_MAX = 999;

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
  exportFormat: ExportFormat;
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

    exportColumns: [
      {
        id: 1,
        type: 'number',
      } as const,
      {
        id: 2,
        type: 'match_in_context',
        context: 20,
        contextRightOverride: undefined,
        primaryNodeRefs: [],
        secondaryNodeRefs: [],
        segmentation: '',
      } as const,
    ],
    exportColumnsMaxId: 2,
    exportFormat: 'csv',
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

const useGetSelectedCorpusSet = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => Promise<string>) => {
  const getCorporaQueryData = useGetCorporaQueryData(options);
  const getState = useGetState();

  return async () => {
    const corporaQueryData = await getCorporaQueryData();
    const { selectedCorpusSet } = getState();
    return toSelectedCorpusSet(corporaQueryData?.sets, selectedCorpusSet);
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

const useGetSelectedCorpusNamesInSelectedSet = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => Promise<string[]>) => {
  const getCorporaQueryData = useGetCorporaQueryData(options);
  const getSelectedCorpusSet = useGetSelectedCorpusSet();
  const getState = useGetState();

  return async () => {
    const corporaQueryData = await getCorporaQueryData();
    const selectedCorpusSet = await getSelectedCorpusSet();
    const { selectedCorpusNames } = getState();

    return toSelectedCorpusNamesInSet(
      corporaQueryData?.corpora,
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

const useGetAqlQuery = (): (() => string) => {
  const getState = useGetState();
  return () => getState().aqlQuery;
};

const useGetAqlQueryDebounced = (): (() => string) => {
  const getState = useGetState();
  return () => getState().aqlQueryDebounced;
};

export const useQueryLanguage = (): QueryLanguage =>
  useSelector((state) => state.queryLanguage);

const useGetQueryLanguage = (): (() => QueryLanguage) => {
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

const useGetExportColumns = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => Promise<ExportColumn[]>) => {
  const getSelectedCorpusNamesInSelectedSet =
    useGetSelectedCorpusNamesInSelectedSet(options);

  const getExportableAnnoKeysQueryData =
    useGetExportableAnnoKeysQueryData(options);
  const getSegmentationsQueryData = useGetSegmentationsQueryData(options);
  const getQueryNodes = useGetQueryNodes(options);

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

const useGetQueryNodes = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => Promise<QueryNodesResult | undefined>) => {
  const getQueryNodesQueryData = useGetQueryNodesQueryData(options);
  const getAqlQueryDebounced = useGetAqlQueryDebounced();
  const getQueryLanguage = useGetQueryLanguage();

  return async (): Promise<QueryNodesResult | undefined> =>
    await getQueryNodesQueryData({
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

export const useExportFormat = (): ExportFormat =>
  useSelector((state) => state.exportFormat);

export const useGetExportFormat = (): (() => ExportFormat) => {
  const getState = useGetState();
  return () => getState().exportFormat;
};

export type ExportPreflight = {
  spec: ExportSpec;
} & (
  | {
      canExport: true;
      impediments: undefined;
    }
  | {
      canExport: false;
      impediments: string[];
    }
);

export const useExportPreflight = (): ExportPreflight => {
  const corpusNames = useSelectedCorpusNamesInSelectedSet();
  const aqlQuery = useAqlQuery();
  const queryLanguage = useQueryLanguage();
  const { data: queryValidationResult } = useQueryValidationResult();
  const exportColumns = useExportColumnItems();
  const exportFormat = useExportFormat();

  return toExportPreflight(
    corpusNames,
    aqlQuery,
    queryLanguage,
    queryValidationResult,
    exportColumns,
    exportFormat,
  );
};

const useGetExportPreflight = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => Promise<ExportPreflight>) => {
  const getSelectedCorpusNamesInSelectedSet =
    useGetSelectedCorpusNamesInSelectedSet(options);
  const getAqlQuery = useGetAqlQuery();
  const getQueryValidationResultQueryData =
    useGetQueryValidationResultQueryData(options);
  const getQueryLanguage = useGetQueryLanguage();
  const getExportColumns = useGetExportColumns(options);
  const getExportFormat = useGetExportFormat();

  return async () => {
    const corpusNames = await getSelectedCorpusNamesInSelectedSet();
    const aqlQuery = getAqlQuery();
    const queryLanguage = getQueryLanguage();
    const queryValidationResult = await getQueryValidationResultQueryData({
      aqlQuery,
      queryLanguage,
    });
    const exportColumns = await getExportColumns();
    const exportFormat = getExportFormat();

    return toExportPreflight(
      corpusNames,
      aqlQuery,
      queryLanguage,
      queryValidationResult,
      exportColumns,
      exportFormat,
    );
  };
};

const toExportPreflight = (
  corpusNames: string[],
  aqlQuery: string,
  queryLanguage: QueryLanguage,
  queryValidationResult: QueryValidationResult | undefined,
  exportColumns: ExportColumn[],
  exportFormat: ExportFormat,
): ExportPreflight => {
  const impediments: string[] = [];

  if (corpusNames.length === 0) {
    impediments.push('No corpus selected');
  }

  if (queryValidationResult === undefined) {
    impediments.push('Query is empty');
  } else if (queryValidationResult.type === 'invalid') {
    impediments.push('Query is invalid');
  }

  if (exportColumns.length === 0) {
    impediments.push('No columns defined');
  }

  exportColumns.forEach((column, index) => {
    getExportColumnImpediments(column).forEach((impediment) => {
      impediments.push(`Column ${index + 1}: ${impediment}`);
    });
  });

  return {
    spec: {
      corpusNames,
      aqlQuery,
      queryLanguage,
      exportColumns,
      exportFormat,
    },
    ...(impediments.length === 0
      ? { canExport: true, impediments: undefined }
      : { canExport: false, impediments }),
  };
};

const getExportColumnImpediments = (exportColumn: ExportColumn): string[] => {
  const impediments: string[] = [];

  switch (exportColumn.type) {
    case 'anno_corpus':
    case 'anno_document':
      if (exportColumn.annoKey === undefined) {
        impediments.push('No meta annotation selected');
      }
      break;

    case 'anno_match':
      if (exportColumn.annoKey === undefined) {
        impediments.push('No annotation selected');
      }
      if (exportColumn.nodeRef === undefined) {
        impediments.push('No query node selected');
      }
      break;

    case 'match_in_context':
      if (exportColumn.segmentation === undefined) {
        impediments.push('No segmentation selected');
      }
      if (
        isNaN(exportColumn.context) ||
        (exportColumn.contextRightOverride !== undefined &&
          isNaN(exportColumn.contextRightOverride))
      ) {
        impediments.push('No context selected');
      }
      break;
  }

  return impediments;
};

// STATE SET

export const useSetSelectedCorpusSet = (): ((
  corpusSet: string,
) => Promise<void>) => {
  const setState = useSetState();
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();

  return async (corpusSet: string) => {
    setState({
      selectedCorpusSet: corpusSet,
    });
    await updateCorpusNamesToPreload();
  };
};

export const useToggleCorpus = (): ((corpusName: string) => Promise<void>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const setState = useSetState();
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();

  return async (corpusName: string) => {
    const { corpora } = await getCorporaQueryData();

    setState((state) => ({
      selectedCorpusNames: corpora
        .filter(
          ({ name }) =>
            state.selectedCorpusNames.includes(name) !== (name === corpusName),
        )
        .map((c) => c.name),
    }));

    await updateCorpusNamesToPreload();
  };
};

export const useToggleAllCorporaInSelectedSet = (): (() => Promise<void>) => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const setState = useSetState();
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();

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

    await updateCorpusNamesToPreload();
  };
};

let aqlQueryDebounceTimeout: number | undefined;

export const useSetAqlQuery = (): ((aqlQuery: string) => void) => {
  const setState = useSetState();

  return (aqlQuery: string) => {
    setState(() => ({
      aqlQuery,
    }));

    if (aqlQueryDebounceTimeout !== undefined) {
      window.clearTimeout(aqlQueryDebounceTimeout);
    }

    if (aqlQuery === '') {
      setState(() => ({
        aqlQueryDebounced: '',
      }));
    } else {
      aqlQueryDebounceTimeout = window.setTimeout(() => {
        setState(() => ({
          aqlQueryDebounced: aqlQuery,
        }));
      }, 300);
    }
  };
};

export const useFlushAqlQueryDebounce = (): (() => void) => {
  const setState = useSetState();

  return () => {
    if (aqlQueryDebounceTimeout !== undefined) {
      window.clearTimeout(aqlQueryDebounceTimeout);
    }

    setState((state) =>
      state.aqlQuery === state.aqlQueryDebounced
        ? state
        : { aqlQueryDebounced: state.aqlQuery },
    );
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

export const useSetExportFormat = (): ((
  exportFormat: ExportFormat,
) => void) => {
  const setState = useSetState();
  return (exportFormat: ExportFormat) => setState({ exportFormat });
};

// QUERIES

export { useDbDirQuery as useDbDir } from '@/lib/queries';

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

export const useQueryNodes =
  (): UseSlowTrackingQueryResult<QueryNodesResult> => {
    const aqlQueryDebounced = useSelector((state) => state.aqlQueryDebounced);
    const queryLanguage = useQueryLanguage();

    return useQueryNodesQuery({
      aqlQuery: aqlQueryDebounced,
      queryLanguage,
    });
  };

export const useQueryValidationResult = (): UseSlowTrackingQueryResult<
  QueryValidationResult | undefined
> => {
  const aqlQueryDebounced = useSelector((state) => state.aqlQueryDebounced);
  const queryLanguage = useQueryLanguage();

  return useQueryValidationResultQuery({
    aqlQuery: aqlQueryDebounced,
    queryLanguage,
  });
};

export const useSegmentations = (): UseSlowTrackingQueryResult<string[]> => {
  const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();

  return useSegmentationsQuery({
    corpusNames: selectedCorpusNames,
  });
};

export const useExportableAnnoKeys =
  (): UseSlowTrackingQueryResult<ExportableAnnoKeys> => {
    const selectedCorpusNames = useSelectedCorpusNamesInSelectedSet();

    return useExportableAnnoKeysQuery({
      corpusNames: selectedCorpusNames,
    });
  };

// MUTATIONS

export {
  useAddCorporaToSetMutation as useAddCorporaToSet,
  useApplyAppUpdateMutation as useApplyAppUpdate,
  useClearCacheMutation as useClearCache,
  useCreateCorpusSetMutation as useCreateCorpusSet,
  useImportCorporaMutation as useImportCorpora,
  useIsExporting,
  useToggleCorpusInSetMutation as useToggleCorpusInSet,
} from '@/lib/mutations';

export const useDeleteCorpus = () => {
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();

  return useDeleteCorpusMutation({
    onSuccess: () => updateCorpusNamesToPreload(),
  });
};

export const useDeleteCorpusSet = () => {
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();
  const setState = useSetState();

  return useDeleteCorpusSetMutation({
    onSuccess: async (args) => {
      setState((state) => ({
        selectedCorpusSet:
          state.selectedCorpusSet === args.corpusSet
            ? ''
            : state.selectedCorpusSet,
      }));
    },
    onSettled: () => updateCorpusNamesToPreload(),
  });
};

export const useExportMatches = () => {
  const flushAqlQueryDebounce = useFlushAqlQueryDebounce();
  const getExportPreflight = useGetExportPreflight();

  return useExportMatchesMutation(async () => {
    flushAqlQueryDebounce();
    const { spec, canExport, impediments } = await getExportPreflight();

    if (!canExport) {
      throw new Error(impediments.join('\n'));
    }

    return { spec };
  });
};

type LoadProjectResult = {
  corpusSet: string;
  missingCorpusNames: string[];
};

export const useLoadProject = () => {
  const getCorporaQueryData = useGetCorporaQueryData();
  const setState = useSetState();
  const updateCorpusNamesToPreload = useUpdateCorpusNamesToPreload();

  return useLoadProjectMutation(
    async ({ project }): Promise<LoadProjectResult> => {
      const { corpora, sets } = await getCorporaQueryData();

      const selectedCorpora = corpora.filter((corpus) =>
        project.spec.corpusNames.includes(corpus.name),
      );
      const missingCorpusNames = project.spec.corpusNames.filter((name) =>
        corpora.every((c) => c.name !== name),
      );
      const selectedCorpusSet =
        sets.includes(project.corpusSet) &&
        selectedCorpora.every((c) =>
          c.includedInSets.includes(project.corpusSet),
        )
          ? project.corpusSet
          : '';

      setState((state) => {
        const [exportColumns, exportColumnsMaxId] =
          project.spec.exportColumns.reduce<[ExportColumnItem[], number]>(
            ([exportColumns, maxId], exportColumn) => {
              const id = (maxId + 1) % Number.MAX_SAFE_INTEGER;
              return [
                [
                  ...exportColumns,
                  { ...sanitizeExportColumn(exportColumn), id },
                ],
                id,
              ];
            },
            [[], state.exportColumnsMaxId],
          );

        return {
          selectedCorpusSet,
          selectedCorpusNames: selectedCorpora.map((c) => c.name),
          aqlQuery: project.spec.aqlQuery,
          aqlQueryDebounced: project.spec.aqlQuery,
          queryLanguage: project.spec.queryLanguage,
          exportColumns,
          exportColumnsMaxId,
          exportFormat: project.spec.exportFormat,
        };
      });

      await updateCorpusNamesToPreload();

      return {
        corpusSet: project.corpusSet,
        missingCorpusNames,
      };
    },
  );
};

const sanitizeExportColumn = (exportColumn: ExportColumn): ExportColumn => {
  if (exportColumn.type === 'match_in_context') {
    return {
      ...exportColumn,
      context: Math.max(
        CONTEXT_MIN,
        Math.min(CONTEXT_MAX, exportColumn.context),
      ),
      contextRightOverride:
        exportColumn.contextRightOverride === undefined
          ? undefined
          : Math.max(
              CONTEXT_MIN,
              Math.min(CONTEXT_MAX, exportColumn.contextRightOverride),
            ),
    };
  }

  return exportColumn;
};

export const useRenameCorpusSet = () => {
  const setState = useSetState();

  return useRenameCorpusSetMutation({
    onSuccess: async (args) => {
      setState((state) => ({
        selectedCorpusSet:
          state.selectedCorpusSet === args.corpusSet
            ? args.newCorpusSet
            : state.selectedCorpusSet,
      }));
    },
  });
};

export const useSaveProject = () => {
  const getSelectedCorpusSet = useGetSelectedCorpusSet({ wait: false });
  const getExportPreflight = useGetExportPreflight({ wait: false });

  return useSaveProjectMutation(async () => {
    const corpusSet = await getSelectedCorpusSet();
    const { spec } = await getExportPreflight();

    return {
      project: { corpusSet, spec },
    };
  });
};

const useUpdateCorpusNamesToPreload = () => {
  const getSelectedCorpusNamesInSelectedSet =
    useGetSelectedCorpusNamesInSelectedSet();
  const { mutation } = useSetCorpusNamesToPreloadMutation();

  return async () =>
    mutation.mutate({
      corpusNames: await getSelectedCorpusNamesInSelectedSet(),
    });
};
