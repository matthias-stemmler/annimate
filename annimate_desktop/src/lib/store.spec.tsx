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
  useAddExportColumn,
  useAqlQuery,
  useCanExport,
  useCorpusNamesInSelectedSet,
  useExportColumnItems,
  useExportFormat,
  useExportMatches,
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
        return {
          corpus: [
            {
              annoKey: ANNO_KEY_CORPUS,
              displayName: 'corpus_name',
            },
          ],
          doc: [
            {
              annoKey: ANNO_KEY_DOCUMENT,
              displayName: 'document_name',
            },
          ],
          node: [
            {
              annoKey: ANNO_KEY_NODE,
              displayName: 'node_name',
            },
          ],
        } satisfies ExportableAnnoKeys;
      }

      case 'get_query_nodes': {
        const { aqlQuery } = payload as { aqlQuery: string };

        return {
          type: 'valid',
          nodes:
            aqlQuery === ''
              ? []
              : [
                  [{ queryFragment: 'foo', variable: '1' }],
                  [{ queryFragment: 'bar', variable: '2' }],
                ],
        } satisfies QueryNodesResult;
      }

      case 'get_segmentations': {
        const { corpusNames } = payload as { corpusNames: string[] };
        return corpusNames.length === 0 ? [] : ['segmentation', ''];
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
        selectedCorpusSet: useSelectedCorpusSet(),
        setSelectedCorpusSet: useSetSelectedCorpusSet(),

        corpusNames: useCorpusNamesInSelectedSet(),
        selectedCorpusNames: useSelectedCorpusNamesInSelectedSet(),

        toggleCorpus: useToggleCorpus(),
        toggleAllCorpora: useToggleAllCorporaInSelectedSet(),
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

    result.current.setSelectedCorpusSet('set1');
    await waitFor(() => {
      expect(result.current.corpusNames.data).toEqual(['a', 'b']);
      expect(result.current.selectedCorpusNames).toEqual([]);
    });

    result.current.toggleCorpus('b');
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['b']);
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['a', 'b']);
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual([]);
    });

    result.current.setSelectedCorpusSet('');
    await waitFor(() => {
      expect(result.current.corpusNames.data).toEqual(['a', 'b', 'c']);
      expect(result.current.selectedCorpusNames).toEqual(['c']);
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
        exportColumns: useExportColumnItems(),
        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
        reorderExportColumn: useReorderExportColumns(),
        removeExportColumn: useRemoveExportColumn(),
        toggleCorpus: useToggleCorpus(),
        unremoveExportColumn: useUnremoveExportColumn(),
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
        exportColumns: useExportColumnItems(),
        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

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
        exportColumns: useExportColumnItems(),
        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

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
        exportColumns: useExportColumnItems(),
        addExportColumn: useAddExportColumn(),
        setAqlQuery: useSetAqlQuery(),
        updateExportColumn: useUpdateExportColumn(),
      }),
      { wrapper: Wrapper },
    );

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
        exportColumns: useExportColumnItems(),
        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
        setAqlQuery: useSetAqlQuery(),
        toggleCorpus: useToggleCorpus(),
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

  type ChangeContext = {
    setSelectedCorpusSet: (corpusSet: string) => void;
    toggleCorpus: (corpusName: string) => void;
    setAqlQuery: (aqlQuery: string) => void;
    addExportColumn: (type: ExportColumnType) => void;
    updateExportColumn: (id: number, update: ExportColumnUpdate) => void;
  };

  const allChanges: ((c: ChangeContext) => void)[] = [
    (c) => c.setSelectedCorpusSet('set1'),
    (c) => c.toggleCorpus('a'),
    (c) => c.setAqlQuery('valid'),
    (c) => c.addExportColumn('anno_corpus'),
    (c) =>
      c.updateExportColumn(3, {
        type: 'anno_corpus',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_CORPUS,
        },
      }),
    (c) => c.addExportColumn('anno_document'),
    (c) =>
      c.updateExportColumn(4, {
        type: 'anno_document',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      }),
    (c) => c.addExportColumn('anno_match'),
    (c) =>
      c.updateExportColumn(5, {
        type: 'anno_match',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_NODE,
        },
      }),
    (c) =>
      c.updateExportColumn(5, {
        type: 'anno_match',
        payload: {
          type: 'update_node_ref',
          nodeRef: { index: 0, variables: ['1'] },
        },
      }),
    (c) => c.addExportColumn('match_in_context'),
    (c) =>
      c.updateExportColumn(6, {
        type: 'match_in_context',
        payload: {
          type: 'update_segmentation',
          segmentation: 'segmentation',
        },
      }),
  ];

  test.each([
    {
      description: 'all changes',
      changes: allChanges,
      expectCanExport: true,
    },
    ...allChanges.map((_, i) => ({
      description: `all changes except #${i + 1}`,
      changes: allChanges.filter((_, j) => j !== i),
      expectCanExport: false,
    })),
  ])(
    'checking if export is possible ($description -> $expectCanExport)',
    async ({ changes, expectCanExport }) => {
      const { result } = renderHook(
        () => ({
          setSelectedCorpusSet: useSetSelectedCorpusSet(),
          corpusNames: useCorpusNamesInSelectedSet(),
          toggleCorpus: useToggleCorpus(),

          setAqlQuery: useSetAqlQuery(),

          addExportColumn: useAddExportColumn(),
          updateExportColumn: useUpdateExportColumn(),

          canExport: useCanExport(),
        }),
        { wrapper: Wrapper },
      );

      await waitFor(() => {
        expect(result.current.corpusNames.isSuccess).toBe(true);
      });

      result.current.toggleCorpus('c');
      changes.forEach((c) => c(result.current));

      await waitFor(() => {
        expect(result.current.canExport).toBe(expectCanExport);
      });
    },
  );

  test('exporting matches', async () => {
    const { result } = renderHook(
      () => ({
        setSelectedCorpusSet: useSetSelectedCorpusSet(),
        corpusNames: useCorpusNamesInSelectedSet(),
        toggleCorpus: useToggleCorpus(),

        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),

        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),

        setExportFormat: useSetExportFormat(),

        canExport: useCanExport(),
        exportMatches: useExportMatches(),
        isExporting: useIsExporting(),
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
        corpusNames: useCorpusNamesInSelectedSet(),
        selectedCorpusSet: useSelectedCorpusSet(),
        selectedCorpusNames: useSelectedCorpusNamesInSelectedSet(),
        aqlQuery: useAqlQuery(),
        queryLanguage: useQueryLanguage(),
        exportColumns: useExportColumnItems(),
        exportFormat: useExportFormat(),
        canExport: useCanExport(),

        loadProject: useLoadProject(),
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
  });

  test('saving a project', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNamesInSelectedSet(),
        canExport: useCanExport(),

        setSelectedCorpusSet: useSetSelectedCorpusSet(),
        toggleCorpus: useToggleCorpus(),
        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),
        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),
        setExportFormat: useSetExportFormat(),

        saveProject: useSaveProject(),
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
