import { relaunch } from '@tauri-apps/api/process';
import { invoke } from '@tauri-apps/api/tauri';

export { relaunch };

export const fetchCorpusNames = (): Promise<string[]> =>
  invoke('get_corpus_names');
