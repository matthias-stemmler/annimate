import {
  Corpora,
  ExportColumn,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryNodesResult,
  QueryValidationResult,
  StatusEvent,
} from '@/lib/api-types';
import { save } from '@tauri-apps/api/dialog';
import { UnlistenFn } from '@tauri-apps/api/event';
import { dirname } from '@tauri-apps/api/path';
import { exit, relaunch } from '@tauri-apps/api/process';
import { open } from '@tauri-apps/api/shell';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

export { dirname, exit, open, relaunch, save };

export const exportMatches = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  exportColumns: ExportColumn[];
  outputFile: string;
}): Promise<void> => invoke('export_matches', params);

export const getCorpora = (): Promise<Corpora> => invoke('get_corpora');

export const getExportableAnnoKeys = (params: {
  corpusNames: string[];
}): Promise<ExportableAnnoKeys> => invoke('get_exportable_anno_keys', params);

export const getQueryNodes = (params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryNodesResult> => invoke('get_query_nodes', params);

export const getSegmentations = (params: {
  corpusNames: string[];
}): Promise<string[]> => invoke('get_segmentations', params);

export const toggleCorpusInSet = (params: {
  corpusSet: string;
  corpusName: string;
}): Promise<void> => invoke('toggle_corpus_in_set', params);

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
