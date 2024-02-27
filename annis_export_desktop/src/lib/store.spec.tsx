import { StoreProvider } from '@/components/store-provider';
import { QueryLanguage } from '@/lib/api';
import {
  useAddExportColumn,
  useAqlQuery,
  useCanExport,
  useCorpusNames,
  useExportColumns,
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
import { renderHook, waitFor } from '@testing-library/react';
import { FC, PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('store', () => {
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

        case 'get_corpus_names': {
          return ['a', 'b', 'c'];
        }

        case 'validate_query': {
          const { corpusNames, aqlQuery, queryLanguage } = args as {
            corpusNames: string;
            aqlQuery: string;
            queryLanguage: QueryLanguage;
          };

          if (corpusNames.length === 1 && corpusNames[0] === 'b') {
            return {
              type:
                aqlQuery === 'valid' ||
                (aqlQuery === 'valid legacy' && queryLanguage === 'AQLQuirksV3')
                  ? 'valid'
                  : 'invalid',
            };
          } else {
            return { type: 'indeterminate' };
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
    result.current.toggleCorpus('b');

    expect(result.current.aqlQuery).toEqual('');
    expect(result.current.queryLanguage).toEqual('AQL');

    result.current.setAqlQuery('valid');

    await waitFor(() => {
      expect(result.current.aqlQuery).toEqual('valid');
    });

    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toEqual({
        type: 'valid',
      });
    });

    result.current.setAqlQuery('valid legacy');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toEqual({
        type: 'invalid',
      });
    });

    result.current.setQueryLanguage('AQLQuirksV3');

    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toEqual({
        type: 'valid',
      });
    });
  });

  test('managing export columns', async () => {
    const { result } = renderHook(
      () => ({
        exportColumns: useExportColumns(),
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

    result.current.updateExportColumn(2, { type: 'anno_match' });

    await waitFor(() => {
      expect(result.current.exportColumns).toEqual([
        {
          id: 1,
          type: 'anno_corpus',
        },
        {
          id: 2,
          type: 'anno_match',
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
          type: 'anno_match',
        },
        {
          id: 3,
          type: 'match_in_context',
        },
        {
          id: 1,
          type: 'anno_corpus',
        },
      ]);
    });
  });

  test('checking if export is possible', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNames(),
        toggleCorpus: useToggleCorpus(),

        queryValidationResult: useQueryValidationResult(),
        setAqlQuery: useSetAqlQuery(),

        canExport: useCanExport(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    expect(result.current.canExport).toBe(false);

    result.current.toggleCorpus('b');

    expect(result.current.canExport).toBe(false);

    result.current.setAqlQuery('invalid');
    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toBeUndefined();
      expect(result.current.canExport).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toEqual({
        type: 'invalid',
      });
      expect(result.current.canExport).toBe(false);
    });

    result.current.setAqlQuery('valid');
    await waitFor(() => {
      expect(result.current.queryValidationResult.data).toEqual({
        type: 'valid',
      });
      expect(result.current.canExport).toBe(true);
    });
  });

  test('exporting matches', async () => {
    const { result } = renderHook(
      () => ({
        corpusNames: useCorpusNames(),
        toggleCorpus: useToggleCorpus(),

        setAqlQuery: useSetAqlQuery(),
        setQueryLanguage: useSetQueryLanguage(),

        exportMatches: useExportMatches(),
        isExporting: useIsExporting(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.corpusNames.isSuccess).toBe(true);
    });

    result.current.toggleCorpus('b');
    result.current.setAqlQuery('valid');
    result.current.setQueryLanguage('AQLQuirksV3');

    result.current.exportMatches.mutation.mutate({ outputFile: 'out.csv' });

    await waitFor(() => {
      expect(result.current.isExporting).toBe(true);
    });

    expect(exportMatchesSpy).toHaveBeenCalledWith({
      corpusNames: ['b'],
      aqlQuery: 'valid',
      queryLanguage: 'AQLQuirksV3',
      outputFile: 'out.csv',
    });
  });
});
