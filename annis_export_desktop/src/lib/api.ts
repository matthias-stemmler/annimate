import { relaunch } from '@tauri-apps/api/process';
import { invoke } from '@tauri-apps/api/tauri';

export { relaunch };

export type QueryLanguage = 'AQL' | 'AQLQuirksV3';

export type QueryValidationResult =
  | {
      type: 'valid';
    }
  | {
      type: 'invalid';
      desc: string;
      location: LineColumnRange | null;
    }
  | {
      type: 'indeterminate';
    };

export type LineColumnRange = {
  start: LineColumn;
  end: LineColumn | null;
};

export type LineColumn = {
  line: number;
  column: number;
};

export const fetchCorpusNames = (): Promise<string[]> =>
  invoke('get_corpus_names');

export const validateQuery = (
  corpusNames: string[],
  aqlQuery: string,
  queryLanguage: QueryLanguage,
): Promise<QueryValidationResult> =>
  invoke('validate_query', { corpusNames, aqlQuery, queryLanguage });
