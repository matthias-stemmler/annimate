import { StoreProvider } from '@/components/store-provider';
import {
  AnnoKey,
  ExportColumnType,
  ExportableAnnoKeys,
  InvokeArgs,
  Project,
  QueryLanguage,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import { SlowTrackingQueryCache } from '@/lib/slow-queries';
import {
  ExportColumnUpdate,
  ExportPreflight,
  useAddExportColumn,
  useAqlQuery,
  useCorpusNamesInSelectedSet,
  useExportColumnItems,
  useExportFormat,
  useExportMatches,
  useExportPreflight,
  useIsExporting,
  useLoadProject,
  useQueryLanguage,
  useQueryValidationResult,
  useRemoveExportColumn,
  useReorderExportColumns,
  useSaveProject,
  useSelectedCorpusNamesInSelectedSet,
  useSelectedCorpusSet,
  useSetAqlQuery,
  useSetExportFormat,
  useSetQueryLanguage,
  useSetSelectedCorpusSet,
  useToggleAllCorporaInSelectedSet,
  useToggleCorpus,
  useUnremoveExportColumn,
  useUpdateExportColumn,
} from '@/lib/store';
import { arrayMove } from '@dnd-kit/sortable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { FC, PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('store', () => {
  const ANNO_KEY_CORPUS: AnnoKey = {
    ns: 'corpus_ns',
    name: 'corpus_name',
  };
  const ANNO_KEY_DOCUMENT: AnnoKey = {
    ns: 'document_ns',
    name: 'document_name',
  };
  const ANNO_KEY_NODE: AnnoKey = {
    ns: 'node_ns',
    name: 'node_name',
  };
  const ANNO_KEY_UNKNOWN: AnnoKey = {
    ns: 'unknown_ns',
    name: 'unknown_name',
  };

  const Wrapper: FC<PropsWithChildren> = ({ children }) => {
    const queryClient = new QueryClient({
      queryCache: new SlowTrackingQueryCache(),
      defaultOptions: { queries: { retry: false } },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <StoreProvider>{children}</StoreProvider>
      </QueryClientProvider>
    );
  };

  const exportMatchesSpy = vi.fn();
  const saveProjectSpy = vi.fn();
  const setCorpusNamesToPreloadSpy = vi.fn();

  const commandHandler = async (
    cmd: string,
    payload?: InvokeArgs,
  ): Promise<unknown> => {
    switch (cmd) {
      case 'export_matches': {
        exportMatchesSpy(payload);

        return new Promise(() => {
          // never resolve as the `unsubscribe` call cannot be properly mocked and would fail
        });
      }

      case 'get_corpora': {
        return {
          corpora: [
            { name: 'a', includedInSets: ['set1', 'set2'] },
            { name: 'b', includedInSets: ['set1'] },
            { name: 'c', includedInSets: [] },
          ],
          sets: ['set1', 'set2'],
        };
      }

      case 'get_exportable_anno_keys': {
        const { corpusNames } = payload as { corpusNames: string[] };
        const hasCorpora = corpusNames.length > 0;

        return {
          corpus: hasCorpora
            ? [
                {
                  annoKey: ANNO_KEY_CORPUS,
                  displayName: 'corpus_name',
                },
              ]
            : [],
          doc: hasCorpora
            ? [
                {
                  annoKey: ANNO_KEY_DOCUMENT,
                  displayName: 'document_name',
                },
              ]
            : [],
          node: hasCorpora
            ? [
                {
                  annoKey: ANNO_KEY_NODE,
                  displayName: 'node_name',
                },
              ]
            : [],
        } satisfies ExportableAnnoKeys;
      }

      case 'get_query_nodes': {
        const { aqlQuery, queryLanguage } = payload as {
          aqlQuery: string;
          queryLanguage: QueryLanguage;
        };

        return {
          type: 'valid',
          nodes:
            aqlQuery === 'valid' ||
            (aqlQuery === 'valid legacy' && queryLanguage === 'AQLQuirksV3')
              ? [
                  [{ queryFragment: 'foo', variable: '1' }],
                  [{ queryFragment: 'bar', variable: '2' }],
                ]
              : [],
        } satisfies QueryNodesResult;
      }

      case 'get_segmentations': {
        const { corpusNames } = payload as { corpusNames: string[] };
        const hasCorpora = corpusNames.length > 0;
        return hasCorpora ? ['segmentation', ''] : [];
      }

      case 'load_project': {
        const { inputFile } = payload as { inputFile: string };

        if (inputFile === 'project.anmt') {
          return {
            corpusSet: 'set1',
            spec: {
              corpusNames: ['a', 'z'],
              aqlQuery: 'valid',
              queryLanguage: 'AQLQuirksV3',
              exportColumns: [
                { type: 'number' },
                {
                  type: 'match_in_context',
                  context: 5,
                  contextRightOverride: 1500,
                  primaryNodeRefs: [{ index: 1, variables: ['2'] }],
                  secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
                  segmentation: 'segmentation',
                },
                { type: 'anno_corpus', annoKey: ANNO_KEY_CORPUS },
                { type: 'anno_document', annoKey: ANNO_KEY_DOCUMENT },
                {
                  type: 'anno_match',
                  annoKey: ANNO_KEY_NODE,
                  nodeRef: { index: 1, variables: ['2'] },
                },
              ],
              exportFormat: 'xlsx',
            },
          } satisfies Project;
        }

        throw new Error(`Failed to load project: File ${inputFile} not found`);
      }

      case 'save_project': {
        saveProjectSpy(payload);
        return;
      }

      case 'set_corpus_names_to_preload': {
        setCorpusNamesToPreloadSpy(payload);
        return;
      }

      case 'validate_query': {
        const { aqlQuery, queryLanguage } = payload as {
          aqlQuery: string;
          queryLanguage: QueryLanguage;
        };

        return (
          aqlQuery === 'valid' ||
          (aqlQuery === 'valid legacy' && queryLanguage === 'AQLQuirksV3')
            ? {
                type: 'valid',
              }
            : {
                type: 'invalid',
                desc: '',
                location: null,
              }
        ) satisfies QueryValidationResult;
      }

      // ignore Tauri-internal commands
      case 'plugin:event|listen':
        return;

      default:
        throw new Error(`Unmocked IPC command: ${cmd}`);
    }
  };

  beforeEach(() => {
    mockWindows('main');
    mockIPC(
      async <T,>(cmd: string, payload?: InvokeArgs) =>
        commandHandler(cmd, payload) as T,
    );
  });

  afterEach(() => {
    cleanup();
    clearMocks();
    vi.clearAllMocks();
  });

  test('selecting corpus sets and corpora', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNamesInSelectedSet(),
        selectedCorpusNames: useSelectedCorpusNamesInSelectedSet(),
        selectedCorpusSet: useSelectedCorpusSet(),
        setSelectedCorpusSet: useSetSelectedCorpusSet(),
        toggleAllCorpora: useToggleAllCorporaInSelectedSet(),
        toggleCorpus: useToggleCorpus(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    expect(result.current.corpusNames.data).toEqual(['a', 'b', 'c']);
    expect(result.current.selectedCorpusNames).toEqual([]);

    result.current.toggleCorpus('c');
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['c']);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: ['c'],
    });

    result.current.setSelectedCorpusSet('set1');
    await waitFor(() => {
      expect(result.current.corpusNames.data).toEqual(['a', 'b']);
      expect(result.current.selectedCorpusNames).toEqual([]);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: [],
    });

    result.current.toggleCorpus('b');
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['b']);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: ['b'],
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['a', 'b']);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: ['a', 'b'],
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual([]);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: [],
    });

    result.current.setSelectedCorpusSet('');
    await waitFor(() => {
      expect(result.current.corpusNames.data).toEqual(['a', 'b', 'c']);
      expect(result.current.selectedCorpusNames).toEqual(['c']);
    });
    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: ['c'],
    });
  });

  test('validating AQL query', async () => {
    const { result } = renderHook(
      () => ({
        aqlQuery: useAqlQuery(),
        queryLanguage: useQueryLanguage(),
        queryValidationResult: useQueryValidationResult(),
        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),
      }),
      { wrapper: Wrapper },
    );

    expect(result.current.aqlQuery).toEqual('');
    expect(result.current.queryLanguage).toEqual('AQL');

    result.current.setAqlQuery('valid');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data?.type).toBe('valid');
    });

    result.current.setAqlQuery('valid legacy');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data?.type).toBe('invalid');
    });

    result.current.setQueryLanguage('AQLQuirksV3');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data?.type).toBe('valid');
    });
  });

  test('managing export columns', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        exportColumns: useExportColumnItems(),
        removeExportColumn: useRemoveExportColumn(),
        reorderExportColumn: useReorderExportColumns(),
        toggleCorpus: useToggleCorpus(),
        unremoveExportColumn: useUnremoveExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    result.current.toggleCorpus('a');

    expect(result.current.exportColumns).toHaveLength(2);

    result.current.addExportColumn('anno_corpus');
    result.current.addExportColumn('anno_document');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'number',
        },
        {
          id: 2,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 4,
          type: 'anno_document',
        },
      ]);
    });

    result.current.updateExportColumn(4, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_DOCUMENT,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'number',
        },
        {
          id: 2,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 4,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      ]);
    });

    result.current.removeExportColumn(2);

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'number',
        },
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 4,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      ]);
    });

    result.current.addExportColumn('match_in_context');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'number',
        },
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 4,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
        {
          id: 5,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
      ]);
    });

    result.current.reorderExportColumn((cs) => {
      const index1 = cs.findIndex((c) => c.id === 1);
      const index3 = cs.findIndex((c) => c.id === 3);
      return arrayMove(cs, index1, index3);
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 1,
          type: 'number',
        },
        {
          id: 4,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
        {
          id: 5,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
      ]);
    });

    result.current.unremoveExportColumn(2);

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 2,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
        {
          id: 3,
          type: 'anno_corpus',
        },
        {
          id: 1,
          type: 'number',
        },
        {
          id: 4,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
        {
          id: 5,
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
          segmentation: '',
        },
      ]);
    });
  });

  test('selecting anno_corpus export column data', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        exportColumns: useExportColumnItems(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    result.current.toggleCorpus('a');
    result.current.addExportColumn('anno_corpus');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_corpus',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_CORPUS,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_corpus',
        annoKey: ANNO_KEY_CORPUS,
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_corpus',
        annoKey: undefined,
      });
    });
  });

  test('selecting anno_document export column data', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        exportColumns: useExportColumnItems(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    result.current.toggleCorpus('a');
    result.current.addExportColumn('anno_document');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_document',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_DOCUMENT,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_document',
        annoKey: ANNO_KEY_DOCUMENT,
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_document',
        annoKey: undefined,
      });
    });
  });

  test('selecting anno_match export column data', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        exportColumns: useExportColumnItems(),
        setAqlQuery: useSetAqlQuery(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    result.current.toggleCorpus('a');
    result.current.setAqlQuery('valid');
    result.current.addExportColumn('anno_match');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_match',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['1'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_match',
        annoKey: ANNO_KEY_NODE,
        nodeRef: { index: 0, variables: ['1'] },
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });
    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 2, variables: ['1', '2'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_match',
        annoKey: undefined,
        nodeRef: { index: 0, variables: ['1'] },
      });
    });

    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(3, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['3'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'anno_match',
        annoKey: ANNO_KEY_NODE,
        nodeRef: undefined,
      });
    });
  });

  test('selecting match_in_context export column data', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        exportColumns: useExportColumnItems(),
        setAqlQuery: useSetAqlQuery(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    result.current.toggleCorpus('a');
    result.current.setAqlQuery('valid');
    result.current.addExportColumn('match_in_context');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 20,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: '',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'update_segmentation',
        segmentation: 'segmentation',
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 20,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: 'segmentation',
      });
    });

    result.current.toggleCorpus('a');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 20,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: undefined,
      });
    });

    result.current.toggleCorpus('a');

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 20,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: 'segmentation',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'update_context',
        context: 42,
      },
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'update_context_right_override',
        contextRightOverride: 43,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 42,
        contextRightOverride: 43,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: 'segmentation',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'toggle_primary_node_ref',
        nodeRef: {
          index: 0,
          variables: ['1'],
        },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 42,
        contextRightOverride: 43,
        primaryNodeRefs: [{ index: 1, variables: ['2'] }],
        secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
        segmentation: 'segmentation',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'toggle_primary_node_ref',
        nodeRef: {
          index: 0,
          variables: ['1'],
        },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 42,
        contextRightOverride: 43,
        primaryNodeRefs: [
          { index: 1, variables: ['2'] },
          { index: 0, variables: ['1'] },
        ],
        secondaryNodeRefs: [],
        segmentation: 'segmentation',
      });
    });

    result.current.updateExportColumn(3, {
      type: 'match_in_context',
      payload: {
        type: 'reorder_primary_node_refs',
        reorder: (primaryNodeRefs) => [...primaryNodeRefs].reverse(),
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toContainEqual({
        id: 3,
        type: 'match_in_context',
        context: 42,
        contextRightOverride: 43,
        primaryNodeRefs: [
          { index: 0, variables: ['1'] },
          { index: 1, variables: ['2'] },
        ],
        secondaryNodeRefs: [],
        segmentation: 'segmentation',
      });
    });
  });

  test('selecting export format', async () => {
    const { result } = renderHook(
      () => ({
        exportFormat: useExportFormat(),
        setExportFormat: useSetExportFormat(),
      }),
      { wrapper: Wrapper },
    );

    expect(result.current.exportFormat).toEqual('csv');

    result.current.setExportFormat('xlsx');

    await waitFor(() => {
      expect(result.current.exportFormat).toEqual('xlsx');
    });
  });

  type PreflightTestCase = {
    description: string;
    change: (c: ChangeContext) => void;
    expectedPreflight: Partial<ExportPreflight>;
  };

  type ChangeContext = {
    addExportColumn: (type: ExportColumnType) => void;
    removeExportColumn: (id: number) => void;
    setAqlQuery: (aqlQuery: string) => void;
    setSelectedCorpusSet: (corpusSet: string) => void;
    toggleCorpus: (corpusName: string) => void;
    updateExportColumn: (id: number, update: ExportColumnUpdate) => void;
  };

  const preflightTestCases: PreflightTestCase[] = [
    {
      description: 'can export',
      change: () => {},
      expectedPreflight: {
        canExport: true,
        impediments: undefined,
      },
    },
    {
      description: 'cannot export (no corpus selected)',
      change: (c) => c.toggleCorpus('a'),
      expectedPreflight: {
        canExport: false,
        impediments: [
          'No corpus selected',
          'Column 2: No segmentation selected',
          'Column 3: No meta annotation selected',
          'Column 4: No meta annotation selected',
          'Column 5: No annotation selected',
        ],
      },
    },
    {
      description: 'cannot export (empty query)',
      change: (c) => c.setAqlQuery(''),
      expectedPreflight: {
        canExport: false,
        impediments: ['Query is empty', 'Column 5: No query node selected'],
      },
    },
    {
      description: 'cannot export (invalid query)',
      change: (c) => c.setAqlQuery('invalid'),
      expectedPreflight: {
        canExport: false,
        impediments: ['Query is invalid', 'Column 5: No query node selected'],
      },
    },
    {
      description: 'cannot export (no columns)',
      change: (c) => {
        c.removeExportColumn(1);
        c.removeExportColumn(2);
        c.removeExportColumn(3);
        c.removeExportColumn(4);
        c.removeExportColumn(5);
      },
      expectedPreflight: {
        canExport: false,
        impediments: ['No columns defined'],
      },
    },
    {
      description: 'cannot export (no left context)',
      change: (c) => {
        c.updateExportColumn(2, {
          type: 'match_in_context',
          payload: {
            type: 'update_context',
            context: NaN,
          },
        });
      },
      expectedPreflight: {
        canExport: false,
        impediments: ['Column 2: No context selected'],
      },
    },
    {
      description: 'cannot export (no right context)',
      change: (c) => {
        c.updateExportColumn(2, {
          type: 'match_in_context',
          payload: {
            type: 'update_context_right_override',
            contextRightOverride: NaN,
          },
        });
      },
      expectedPreflight: {
        canExport: false,
        impediments: ['Column 2: No context selected'],
      },
    },
  ];

  test.each(preflightTestCases)(
    'export preflight ($description)',
    async ({ change, expectedPreflight }) => {
      const { result } = renderHook(
        () => ({
          addExportColumn: useAddExportColumn(),
          corpusNames: useCorpusNamesInSelectedSet(),
          exportPreflight: useExportPreflight(),
          removeExportColumn: useRemoveExportColumn(),
          setAqlQuery: useSetAqlQuery(),
          setQueryLanguage: useSetQueryLanguage(),
          setSelectedCorpusSet: useSetSelectedCorpusSet(),
          toggleCorpus: useToggleCorpus(),
          updateExportColumn: useUpdateExportColumn(),
        }),
        { wrapper: Wrapper },
      );

      await waitFor(() => {
        expect(result.current.corpusNames.isSuccess).toBe(true);
      });

      result.current.toggleCorpus('a');
      result.current.setAqlQuery('valid');
      result.current.updateExportColumn(2, {
        type: 'match_in_context',
        payload: {
          type: 'update_segmentation',
          segmentation: 'segmentation',
        },
      });
      result.current.addExportColumn('anno_corpus');
      result.current.updateExportColumn(3, {
        type: 'anno_corpus',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_CORPUS,
        },
      });
      result.current.addExportColumn('anno_document');
      result.current.updateExportColumn(4, {
        type: 'anno_document',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      });
      result.current.addExportColumn('anno_match');
      result.current.updateExportColumn(5, {
        type: 'anno_match',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_NODE,
        },
      });
      result.current.updateExportColumn(5, {
        type: 'anno_match',
        payload: {
          type: 'update_node_ref',
          nodeRef: { index: 0, variables: ['1'] },
        },
      });

      change(result.current);

      await waitFor(() => {
        expect(result.current.exportPreflight).toEqual(
          expect.objectContaining(expectedPreflight),
        );
      });
    },
  );

  test('exporting matches', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        canExport: useExportPreflight().canExport,
        corpusNames: useCorpusNamesInSelectedSet(),
        exportMatches: useExportMatches(),
        isExporting: useIsExporting(),
        setAqlQuery: useSetAqlQuery(),
        setExportFormat: useSetExportFormat(),
        setQueryLanguage: useSetQueryLanguage(),
        setSelectedCorpusSet: useSetSelectedCorpusSet(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    result.current.toggleCorpus('a');
    result.current.toggleCorpus('c');
    result.current.setSelectedCorpusSet('set1');
    result.current.setAqlQuery('valid');
    result.current.setQueryLanguage('AQLQuirksV3');

    result.current.updateExportColumn(2, {
      type: 'match_in_context',
      payload: {
        type: 'update_segmentation',
        segmentation: 'segmentation',
      },
    });

    result.current.addExportColumn('anno_corpus');
    result.current.updateExportColumn(3, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_CORPUS,
      },
    });

    result.current.addExportColumn('anno_document');
    result.current.updateExportColumn(4, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_DOCUMENT,
      },
    });

    result.current.addExportColumn('anno_match');
    result.current.updateExportColumn(5, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(5, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['1'] },
      },
    });

    await waitFor(() => {
      expect(result.current.canExport).toBe(true);
    });

    result.current.setExportFormat('xlsx');

    result.current.exportMatches.mutation.mutate({ outputFile: 'out.xlsx' });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(true);
    });

    expect(exportMatchesSpy).toHaveBeenCalledWith({
      eventChannel: expect.anything(),
      spec: {
        corpusNames: ['a'],
        aqlQuery: 'valid',
        queryLanguage: 'AQLQuirksV3',
        exportColumns: [
          expect.objectContaining({
            type: 'number',
          }),
          expect.objectContaining({
            type: 'match_in_context',
            context: 20,
            contextRightOverride: undefined,
            primaryNodeRefs: [
              { index: 0, variables: ['1'] },
              { index: 1, variables: ['2'] },
            ],
            secondaryNodeRefs: [],
            segmentation: 'segmentation',
          }),
          expect.objectContaining({
            type: 'anno_corpus',
            annoKey: ANNO_KEY_CORPUS,
          }),
          expect.objectContaining({
            type: 'anno_document',
            annoKey: ANNO_KEY_DOCUMENT,
          }),
          expect.objectContaining({
            type: 'anno_match',
            annoKey: ANNO_KEY_NODE,
          }),
        ],
        exportFormat: 'xlsx',
      },
      outputFile: 'out.xlsx',
    });
  });

  test('loading a project', async () => {
    const { result } = renderHook(
      () => ({
        aqlQuery: useAqlQuery(),
        canExport: useExportPreflight().canExport,
        corpusNames: useCorpusNamesInSelectedSet(),
        exportColumns: useExportColumnItems(),
        exportFormat: useExportFormat(),
        loadProject: useLoadProject(),
        queryLanguage: useQueryLanguage(),
        selectedCorpusNames: useSelectedCorpusNamesInSelectedSet(),
        selectedCorpusSet: useSelectedCorpusSet(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    const loadProjectResult =
      await result.current.loadProject.mutation.mutateAsync({
        inputFile: 'project.anmt',
      });

    expect(loadProjectResult).toStrictEqual({
      corpusSet: 'set1',
      missingCorpusNames: ['z'],
    });

    await waitFor(() => {
      expect(result.current.selectedCorpusSet).toBe('set1');
      expect(result.current.selectedCorpusNames).toEqual(['a']);
      expect(result.current.aqlQuery).toBe('valid');
      expect(result.current.queryLanguage).toBe('AQLQuirksV3');
      expect(result.current.exportColumns).toEqual([
        { id: 3, type: 'number' },
        {
          id: 4,
          type: 'match_in_context',
          context: 5,
          contextRightOverride: 999,
          primaryNodeRefs: [{ index: 1, variables: ['2'] }],
          secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
          segmentation: 'segmentation',
        },
        { id: 5, type: 'anno_corpus', annoKey: ANNO_KEY_CORPUS },
        { id: 6, type: 'anno_document', annoKey: ANNO_KEY_DOCUMENT },
        {
          id: 7,
          type: 'anno_match',
          annoKey: ANNO_KEY_NODE,
          nodeRef: { index: 1, variables: ['2'] },
        },
      ]);
      expect(result.current.exportFormat).toBe('xlsx');
      expect(result.current.canExport).toBe(true);
    });

    expect(setCorpusNamesToPreloadSpy).toHaveBeenLastCalledWith({
      corpusNames: ['a'],
    });
  });

  test('saving a project', async () => {
    const { result } = renderHook(
      () => ({
        addExportColumn: useAddExportColumn(),
        canExport: useExportPreflight().canExport,
        corpusNames: useCorpusNamesInSelectedSet(),
        saveProject: useSaveProject(),
        setAqlQuery: useSetAqlQuery(),
        setExportFormat: useSetExportFormat(),
        setQueryLanguage: useSetQueryLanguage(),
        setSelectedCorpusSet: useSetSelectedCorpusSet(),
        toggleCorpus: useToggleCorpus(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    result.current.setSelectedCorpusSet('set1');
    result.current.toggleCorpus('a');
    result.current.setAqlQuery('valid');
    result.current.setQueryLanguage('AQLQuirksV3');

    result.current.updateExportColumn(2, {
      type: 'match_in_context',
      payload: {
        type: 'update_segmentation',
        segmentation: 'segmentation',
      },
    });

    result.current.updateExportColumn(2, {
      type: 'match_in_context',
      payload: {
        type: 'update_context',
        context: 5,
      },
    });

    result.current.updateExportColumn(2, {
      type: 'match_in_context',
      payload: {
        type: 'update_context_right_override',
        contextRightOverride: 999,
      },
    });

    result.current.updateExportColumn(2, {
      type: 'match_in_context',
      payload: {
        type: 'toggle_primary_node_ref',
        nodeRef: { index: 0, variables: ['1'] },
      },
    });

    result.current.addExportColumn('anno_corpus');
    result.current.updateExportColumn(3, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_CORPUS,
      },
    });

    result.current.addExportColumn('anno_document');
    result.current.updateExportColumn(4, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_DOCUMENT,
      },
    });

    result.current.addExportColumn('anno_match');
    result.current.updateExportColumn(5, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(5, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 1, variables: ['2'] },
      },
    });

    result.current.setExportFormat('xlsx');

    await waitFor(() => {
      expect(result.current.canExport).toBe(true);
    });

    await result.current.saveProject.mutation.mutateAsync({
      outputFile: 'project.anmt',
    });

    expect(saveProjectSpy).toHaveBeenCalledWith({
      outputFile: 'project.anmt',
      project: {
        corpusSet: 'set1',
        spec: {
          corpusNames: ['a'],
          aqlQuery: 'valid',
          queryLanguage: 'AQLQuirksV3',
          exportColumns: [
            expect.objectContaining({ type: 'number' }),
            expect.objectContaining({
              type: 'match_in_context',
              context: 5,
              contextRightOverride: 999,
              primaryNodeRefs: [{ index: 1, variables: ['2'] }],
              secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
              segmentation: 'segmentation',
            }),
            expect.objectContaining({
              type: 'anno_corpus',
              annoKey: ANNO_KEY_CORPUS,
            }),
            expect.objectContaining({
              type: 'anno_document',
              annoKey: ANNO_KEY_DOCUMENT,
            }),
            expect.objectContaining({
              type: 'anno_match',
              annoKey: ANNO_KEY_NODE,
              nodeRef: { index: 1, variables: ['2'] },
            }),
          ],
          exportFormat: 'xlsx',
        },
      },
    });
  });
});
