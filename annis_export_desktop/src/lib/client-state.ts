import { QueryLanguage } from '@/lib/api';

export type ClientState = {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  selectedCorpusNames: string[];
};

type ClientStateAction =
  | {
      type: 'AQL_QUERY_UPDATED';
      aqlQuery: string;
    }
  | {
      type: 'QUERY_LANGUAGE_UPDATED';
      queryLanguage: QueryLanguage;
    }
  | {
      type: 'CORPUS_ALL_TOGGLED';
      corpusNames: string[];
    }
  | {
      type: 'CORPUS_TOGGLED';
      corpusName: string;
      corpusNames: string[];
    };

export const initialClientState: ClientState = {
  aqlQuery: '',
  queryLanguage: 'AQL',
  selectedCorpusNames: [],
};

export const clientStateReducer = (
  state: ClientState,
  action: ClientStateAction,
): ClientState => {
  switch (action.type) {
    case 'AQL_QUERY_UPDATED': {
      const { aqlQuery } = action;
      return { ...state, aqlQuery };
    }

    case 'QUERY_LANGUAGE_UPDATED': {
      const { queryLanguage } = action;
      return { ...state, queryLanguage };
    }

    case 'CORPUS_ALL_TOGGLED': {
      const { corpusNames } = action;
      return {
        ...state,
        selectedCorpusNames: corpusNames.every((c) =>
          state.selectedCorpusNames.includes(c),
        )
          ? []
          : corpusNames,
      };
    }

    case 'CORPUS_TOGGLED': {
      const { corpusName, corpusNames } = action;
      return {
        ...state,
        selectedCorpusNames: corpusNames.filter(
          (c) => state.selectedCorpusNames.includes(c) !== (c === corpusName),
        ),
      };
    }
  }
};
