import {
  ExportColumn,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryValidationResult,
  StatusEvent,
} from '@/lib/api-types';
import { save } from '@tauri-apps/api/dialog';
import { UnlistenFn } from '@tauri-apps/api/event';
import { dirname } from '@tauri-apps/api/path';
import { relaunch } from '@tauri-apps/api/process';
import { open } from '@tauri-apps/api/shell';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

export { dirname, open, relaunch, save };

export const exportMatches = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  exportColumns: ExportColumn[];
  outputFile: string;
}): Promise<void> => invoke('export_matches', params);

export const getCorpusNames = (): Promise<string[]> =>
  invoke('get_corpus_names');

export const getExportableAnnoKeys = (params: {
  corpusNames: string[];
}): Promise<ExportableAnnoKeys> => invoke('get_exportable_anno_keys', params);

export const validateQuery = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryValidationResult> => invoke('validate_query', params);

export const subscribeToExportStatus = (
  callback: (statusEvent: StatusEvent) => void,
): Promise<UnlistenFn> =>
  appWindow.listen<StatusEvent>('export_status', ({ payload }) =>
    callback(payload),
  );
