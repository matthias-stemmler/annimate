import { relaunch } from '@tauri-apps/api/process';
import { invoke } from '@tauri-apps/api/tauri';

export { relaunch };

export const fetchCorpusNames = (): Promise<string[]> =>
  invoke('get_corpus_names');

export const validateQuery = (
  corpusNames: string[],
  aqlQuery: string,
): Promise<string> => invoke('validate_query', { corpusNames, aqlQuery });
