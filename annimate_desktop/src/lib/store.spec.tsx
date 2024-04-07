import { StoreProvider } from '@/components/store-provider';
import {
  AnnoKey,
  ExportColumnType,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import {
  ExportColumnUpdate,
  useAddExportColumn,
  useAqlQuery,
  useCanExport,
  useCorpusNames,
  useExportColumnItems,
  useExportMatches,
  useIsExporting,
  useQueryLanguage,
  useQueryValidationResult,
  useRemoveExportColumn,
  useReorderExportColumns,
  useSelectedCorpusNames,
  useSetAqlQuery,
  useSetQueryLanguage,
  useToggleAllCorpora,
  useToggleCorpus,
  useUnremoveExportColumn,
  useUpdateExportColumn,
} from '@/lib/store';
import { arrayMove } from '@dnd-kit/sortable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
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
      defaultOptions: { queries: { retry: false } },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <StoreProvider>{children}</StoreProvider>
      </QueryClientProvider>
    );
  };

  const exportMatchesSpy = vi.fn();

  beforeEach(() => {
    mockIPC((cmd, args) => {
      switch (cmd) {
        case 'export_matches': {
          exportMatchesSpy(args);

          return new Promise(() => {
            // never resolve as the `unsubscribe` call cannot be properly mocked and would fail
          });
        }

        case 'get_corpora': {
          return {
            corpora: [
              { name: 'a', includedInSets: [] },
              { name: 'b', includedInSets: [] },
              { name: 'c', includedInSets: [] },
            ],
            sets: [],
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
          const { aqlQuery } = args as { aqlQuery: string };

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
          const { corpusNames } = args as { corpusNames: string[] };
          return corpusNames.length === 0 ? [] : ['segmentation', ''];
        }

        case 'validate_query': {
          const { corpusNames, aqlQuery, queryLanguage } = args as {
            corpusNames: string;
            aqlQuery: string;
            queryLanguage: QueryLanguage;
          };

          if (corpusNames.length === 1 && corpusNames[0] === 'b') {
            return {
              type: 'invalid',
              desc: '',
              location: null,
            } satisfies QueryValidationResult;
          } else {
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
        }

        case 'tauri':
          // ignore Tauri-internal commands
          return;

        default:
          throw new Error(`Unmocked IPC command: ${cmd}`);
      }
    });
  });

  afterEach(() => {
    cleanup();
    clearMocks();
    vi.clearAllMocks();
  });

  test('selecting corpora', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNames(),
        selectedCorpusNames: useSelectedCorpusNames(),
        toggleCorpus: useToggleCorpus(),
        toggleAllCorpora: useToggleAllCorpora(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    expect(result.current.corpusNames.data).toEqual(['a', 'b', 'c']);
    expect(result.current.selectedCorpusNames).toEqual([]);

    result.current.toggleCorpus('b');
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['b']);
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual(['a', 'b', 'c']);
    });

    result.current.toggleAllCorpora();
    await waitFor(() => {
      expect(result.current.selectedCorpusNames).toEqual([]);
    });
  });

  test('validating AQL query', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNames(),
        selectedCorpusNames: useSelectedCorpusNames(),
        toggleCorpus: useToggleCorpus(),

        aqlQuery: useAqlQuery(),
        queryLanguage: useQueryLanguage(),
        queryValidationResult: useQueryValidationResult(),
        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

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

    result.current.toggleCorpus('b');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data?.type).toBe('invalid');
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
        unremoveExportColumn: useUnremoveExportColumn(),
      }),
      { wrapper: Wrapper },
    );

    expect(result.current.exportColumns).toHaveLength(0);

    result.current.addExportColumn('anno_corpus');
    result.current.addExportColumn('anno_document');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
        },
        {
          id: 2,
          type: 'anno_document',
        },
      ]);
    });

    result.current.updateExportColumn(2, {
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
          type: 'anno_corpus',
        },
        {
          id: 2,
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
          type: 'anno_corpus',
        },
      ]);
    });

    result.current.addExportColumn('match_in_context');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
        },
        {
          id: 3,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
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
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
        },
        {
          id: 1,
          type: 'anno_corpus',
        },
      ]);
    });

    result.current.unremoveExportColumn(2);

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 2,
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
        {
          id: 3,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [],
          secondaryNodeRefs: [],
        },
        {
          id: 1,
          type: 'anno_corpus',
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_CORPUS,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
          annoKey: ANNO_KEY_CORPUS,
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
          annoKey: undefined,
        },
      ]);
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_document',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
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
          type: 'anno_document',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_document',
          annoKey: undefined,
        },
      ]);
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_match',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['1'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_match',
          annoKey: ANNO_KEY_NODE,
          nodeRef: { index: 0, variables: ['1'] },
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_UNKNOWN,
      },
    });
    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 2, variables: ['1', '2'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_match',
          annoKey: undefined,
          nodeRef: { index: 0, variables: ['1'] },
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(1, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['3'] },
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_match',
          annoKey: ANNO_KEY_NODE,
          nodeRef: undefined,
        },
      ]);
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: '',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'match_in_context',
      payload: {
        type: 'update_segmentation',
        segmentation: 'segmentation',
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: 'segmentation',
        },
      ]);
    });

    result.current.toggleCorpus('a');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: undefined,
        },
      ]);
    });

    result.current.toggleCorpus('a');

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 20,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: 'segmentation',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'match_in_context',
      payload: {
        type: 'update_context',
        context: 42,
      },
    });

    result.current.updateExportColumn(1, {
      type: 'match_in_context',
      payload: {
        type: 'update_context_right_override',
        contextRightOverride: 43,
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 42,
          contextRightOverride: 43,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: 'segmentation',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 42,
          contextRightOverride: 43,
          primaryNodeRefs: [{ index: 1, variables: ['2'] }],
          secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
          segmentation: 'segmentation',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
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
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 42,
          contextRightOverride: 43,
          primaryNodeRefs: [
            { index: 1, variables: ['2'] },
            { index: 0, variables: ['1'] },
          ],
          secondaryNodeRefs: [],
          segmentation: 'segmentation',
        },
      ]);
    });

    result.current.updateExportColumn(1, {
      type: 'match_in_context',
      payload: {
        type: 'reorder_primary_node_refs',
        reorder: (primaryNodeRefs) => [...primaryNodeRefs].reverse(),
      },
    });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'match_in_context',
          context: 42,
          contextRightOverride: 43,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          secondaryNodeRefs: [],
          segmentation: 'segmentation',
        },
      ]);
    });
  });

  type ChangeContext = {
    toggleCorpus: (corpusName: string) => void;
    setAqlQuery: (aqlQuery: string) => void;
    addExportColumn: (type: ExportColumnType) => void;
    updateExportColumn: (id: number, update: ExportColumnUpdate) => void;
  };

  const allChanges: ((c: ChangeContext) => void)[] = [
    (c) => c.toggleCorpus('a'),
    (c) => c.setAqlQuery('valid'),
    (c) => c.addExportColumn('anno_corpus'),
    (c) =>
      c.updateExportColumn(1, {
        type: 'anno_corpus',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_CORPUS,
        },
      }),
    (c) => c.addExportColumn('anno_document'),
    (c) =>
      c.updateExportColumn(2, {
        type: 'anno_document',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_DOCUMENT,
        },
      }),
    (c) => c.addExportColumn('anno_match'),
    (c) =>
      c.updateExportColumn(3, {
        type: 'anno_match',
        payload: {
          type: 'update_anno_key',
          annoKey: ANNO_KEY_NODE,
        },
      }),
    (c) =>
      c.updateExportColumn(3, {
        type: 'anno_match',
        payload: {
          type: 'update_node_ref',
          nodeRef: { index: 0, variables: ['1'] },
        },
      }),
    (c) => c.addExportColumn('match_in_context'),
    (c) =>
      c.updateExportColumn(4, {
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
          corpusNames: useCorpusNames(),
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

      changes.forEach((c) => c(result.current));

      await waitFor(() => {
        expect(result.current.canExport).toBe(expectCanExport);
      });
    },
  );

  test('exporting matches', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNames(),
        toggleCorpus: useToggleCorpus(),

        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),

        addExportColumn: useAddExportColumn(),
        updateExportColumn: useUpdateExportColumn(),

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
    result.current.setAqlQuery('valid');
    result.current.setQueryLanguage('AQLQuirksV3');

    result.current.addExportColumn('number');

    result.current.addExportColumn('anno_corpus');
    result.current.updateExportColumn(2, {
      type: 'anno_corpus',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_CORPUS,
      },
    });

    result.current.addExportColumn('anno_document');
    result.current.updateExportColumn(3, {
      type: 'anno_document',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_DOCUMENT,
      },
    });

    result.current.addExportColumn('anno_match');
    result.current.updateExportColumn(4, {
      type: 'anno_match',
      payload: {
        type: 'update_anno_key',
        annoKey: ANNO_KEY_NODE,
      },
    });
    result.current.updateExportColumn(4, {
      type: 'anno_match',
      payload: {
        type: 'update_node_ref',
        nodeRef: { index: 0, variables: ['1'] },
      },
    });

    result.current.addExportColumn('match_in_context');
    result.current.updateExportColumn(5, {
      type: 'match_in_context',
      payload: {
        type: 'update_segmentation',
        segmentation: 'segmentation',
      },
    });

    await waitFor(() => {
      expect(result.current.canExport).toBe(true);
    });

    result.current.exportMatches.mutation.mutate({ outputFile: 'out.csv' });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(true);
    });

    expect(exportMatchesSpy).toHaveBeenCalledWith({
      corpusNames: ['a'],
      aqlQuery: 'valid',
      queryLanguage: 'AQLQuirksV3',
      exportColumns: [
        expect.objectContaining({
          type: 'number',
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
        expect.objectContaining({
          type: 'match_in_context',
          context: 20,
          contextRightOverride: undefined,
          primaryNodeRefs: [
            { index: 0, variables: ['1'] },
            { index: 1, variables: ['2'] },
          ],
          segmentation: 'segmentation',
        }),
      ],
      outputFile: 'out.csv',
    });
  });
});
