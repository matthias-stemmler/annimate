import { ExportColumn, ExportColumnType, QueryLanguage } from '@/lib/api';

const MAX_REMOVED_COLUMNS = 3;

export type ClientState = {
  aqlQuery: string;
  exportColumns: ExportColumnItem[];
  exportColumnsMaxId: number;
  queryLanguage: QueryLanguage;
  selectedCorpusNames: string[];
};

export type ExportColumnItem = ExportColumn & {
  id: number;
  removalIndex?: number;
};

type ClientStateAction =
  | {
      type: 'aql_query_updated';
      aqlQuery: string;
    }
  | {
      type: 'export_column_added';
      columnType: ExportColumnType;
    }
  | {
      type: 'export_column_removed';
      id: number;
    }
  | {
      type: 'export_column_unremoved';
      id: number;
    }
  | {
      type: 'export_column_updated';
      id: number;
      exportColumn: ExportColumn;
    }
  | {
      type: 'export_columns_reordered';
      reorder: (exportColumns: ExportColumnItem[]) => ExportColumnItem[];
    }
  | {
      type: 'query_language_updated';
      queryLanguage: QueryLanguage;
    }
  | {
      type: 'corpus_all_toggled';
      corpusNames: string[];
    }
  | {
      type: 'corpus_toggled';
      corpusName: string;
      corpusNames: string[];
    };

export const initialClientState: ClientState = {
  aqlQuery: '',
  exportColumns: [
    { id: 1, type: 'number' },
    { id: 2, type: 'anno_corpus' },
    { id: 3, type: 'anno_document' },
    { id: 4, type: 'anno_match' },
    { id: 5, type: 'match_in_context' },
  ],
  exportColumnsMaxId: 5,
  queryLanguage: 'AQL',
  selectedCorpusNames: [],
};

export const clientStateReducer = (
  state: ClientState,
  action: ClientStateAction,
): ClientState => {
  switch (action.type) {
    case 'aql_query_updated': {
      const { aqlQuery } = action;
      return { ...state, aqlQuery };
    }

    case 'export_column_added': {
      const { columnType } = action;
      const id = (state.exportColumnsMaxId + 1) % Number.MAX_SAFE_INTEGER;

      return {
        ...state,
        exportColumns: [...state.exportColumns, { id, type: columnType }],
        exportColumnsMaxId: id,
      };
    }

    case 'export_column_removed': {
      const { id: idToRemove } = action;

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
        ...state,
        exportColumns: state.exportColumns
          .filter((c) => !idsToRemovePermanently.includes(c.id))
          .map((column) => ({
            ...column,
            removalIndex:
              column.id === idToRemove ? nextRemovalIndex : column.removalIndex,
          })),
      };
    }

    case 'export_column_updated': {
      const { id, exportColumn } = action;

      return {
        ...state,
        exportColumns: state.exportColumns.map((c) =>
          c.id === id ? { ...c, ...exportColumn } : c,
        ),
      };
    }

    case 'export_column_unremoved': {
      const { id: idToUnremove } = action;

      return {
        ...state,
        exportColumns: state.exportColumns.map((column) => ({
          ...column,
          removalIndex:
            column.id === idToUnremove ? undefined : column.removalIndex,
        })),
      };
    }

    case 'export_columns_reordered': {
      const { reorder } = action;
      return { ...state, exportColumns: reorder(state.exportColumns) };
    }

    case 'query_language_updated': {
      const { queryLanguage } = action;
      return { ...state, queryLanguage };
    }

    case 'corpus_all_toggled': {
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

    case 'corpus_toggled': {
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
