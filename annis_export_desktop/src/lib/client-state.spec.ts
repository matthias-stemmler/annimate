import { ClientState, clientStateReducer } from '@/lib/client-state';
import { describe, expect, test } from 'vitest';

describe('client-state', () => {
  const currentState: ClientState = {
    aqlQuery: 'aqlQuery',
    exportColumns: [
      { id: 1, type: 'number' },
      { id: 2, type: 'anno_corpus', removalIndex: 1 },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context' },
    ],
    exportColumnsMaxId: 5,
    queryLanguage: 'AQL',
    selectedCorpusNames: ['a', 'b', 'c'],
  };

  test('aql_query_updated action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'aql_query_updated',
      aqlQuery: 'aqlQuery updated',
    });

    expect(nextState.aqlQuery).toBe('aqlQuery updated');
  });

  test('export_column_added action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'export_column_added',
      columnType: 'number',
    });

    expect(nextState.exportColumns).toEqual([
      { id: 1, type: 'number' },
      { id: 2, type: 'anno_corpus', removalIndex: 1 },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context' },
      { id: 6, type: 'number' },
    ]);
    expect(nextState.exportColumnsMaxId).toBe(6);
  });

  test('export_column_removed action', () => {
    const nextState1 = clientStateReducer(currentState, {
      type: 'export_column_removed',
      id: 1,
    });

    expect(nextState1.exportColumns).toEqual([
      { id: 1, type: 'number', removalIndex: 2 },
      { id: 2, type: 'anno_corpus', removalIndex: 1 },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context' },
    ]);

    const nextState2 = clientStateReducer(nextState1, {
      type: 'export_column_removed',
      id: 5,
    });

    expect(nextState2.exportColumns).toEqual([
      { id: 1, type: 'number', removalIndex: 2 },
      { id: 2, type: 'anno_corpus', removalIndex: 1 },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context', removalIndex: 3 },
    ]);

    const nextState3 = clientStateReducer(nextState2, {
      type: 'export_column_removed',
      id: 4,
    });

    expect(nextState3.exportColumns).toEqual([
      { id: 1, type: 'number', removalIndex: 2 },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match', removalIndex: 4 },
      { id: 5, type: 'match_in_context', removalIndex: 3 },
    ]);
  });

  test('export_column_unremoved action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'export_column_unremoved',
      id: 2,
    });

    expect(nextState.exportColumns).toEqual([
      { id: 1, type: 'number' },
      { id: 2, type: 'anno_corpus' },
      { id: 3, type: 'anno_document' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context' },
    ]);
  });

  test('export_column_updated action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'export_column_updated',
      id: 3,
      exportColumn: {
        type: 'anno_match',
      },
    });

    expect(nextState.exportColumns).toEqual([
      { id: 1, type: 'number' },
      { id: 2, type: 'anno_corpus', removalIndex: 1 },
      { id: 3, type: 'anno_match' },
      { id: 4, type: 'anno_match' },
      { id: 5, type: 'match_in_context' },
    ]);
  });

  test('export_columns_reordered action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'export_columns_reordered',
      reorder: ([c, ...cs]) => [...cs, c],
    });

    expect(nextState.exportColumns.map((c) => c.id)).toEqual([2, 3, 4, 5, 1]);
  });

  test('query_language_updated action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'query_language_updated',
      queryLanguage: 'AQLQuirksV3',
    });

    expect(nextState.queryLanguage).toBe('AQLQuirksV3');
  });

  describe('corpus_all_toggled action', () => {
    test('all corpora selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd', 'c'],
        },
        {
          type: 'corpus_all_toggled',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual([]);
    });

    test('not all corpora selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd'],
        },
        {
          type: 'corpus_all_toggled',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual(['a', 'b', 'c']);
    });
  });

  describe('corpus_toggled action', () => {
    test('corpus selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd', 'c'],
        },
        {
          type: 'corpus_toggled',
          corpusName: 'c',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual(['a', 'b']);
    });

    test('corpus not selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd'],
        },
        {
          type: 'corpus_toggled',
          corpusName: 'c',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual(['a', 'b', 'c']);
    });
  });
});
