import { describe, expect, test } from 'vitest';
import { ClientState, clientStateReducer } from './client-state';

describe('client-state', () => {
  const currentState: ClientState = {
    aqlQuery: 'aqlQuery',
    queryLanguage: 'AQL',
    selectedCorpusNames: ['a', 'b', 'c'],
  };

  test('AQL_QUERY_UPDATED action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'AQL_QUERY_UPDATED',
      aqlQuery: 'aqlQuery updated',
    });

    expect(nextState.aqlQuery).toBe('aqlQuery updated');
  });

  test('QUERY_LANGUAGE_UPDATED action', () => {
    const nextState = clientStateReducer(currentState, {
      type: 'QUERY_LANGUAGE_UPDATED',
      queryLanguage: 'AQLQuirksV3',
    });

    expect(nextState.queryLanguage).toBe('AQLQuirksV3');
  });

  describe('CORPUS_ALL_TOGGLED action', () => {
    test('all corpora selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd', 'c'],
        },
        {
          type: 'CORPUS_ALL_TOGGLED',
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
          type: 'CORPUS_ALL_TOGGLED',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual(['a', 'b', 'c']);
    });
  });

  describe('CORPUS_TOGGLED action', () => {
    test('corpus selected', () => {
      const nextState = clientStateReducer(
        {
          ...currentState,
          selectedCorpusNames: ['b', 'a', 'd', 'c'],
        },
        {
          type: 'CORPUS_TOGGLED',
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
          type: 'CORPUS_TOGGLED',
          corpusName: 'c',
          corpusNames: ['a', 'b', 'c'],
        },
      );

      expect(nextState.selectedCorpusNames).toEqual(['a', 'b', 'c']);
    });
  });
});
