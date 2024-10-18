import {
  Corpora,
  ExportColumn,
  ExportFormat,
  ExportStatusEvent,
  ExportableAnnoKeys,
  ImportStatusEvent,
  QueryLanguage,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import { Channel, invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { dirname } from '@tauri-apps/api/path';
import { open as fileOpen, save } from '@tauri-apps/plugin-dialog';
import { exit, relaunch } from '@tauri-apps/plugin-process';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { check as checkForUpdate } from '@tauri-apps/plugin-updater';

export { checkForUpdate, dirname, exit, fileOpen, relaunch, save, shellOpen };

export const deleteCorpus = (params: { corpusName: string }): Promise<void> =>
  invoke('delete_corpus', params);

export const deleteCorpusSet = (params: {
  corpusSet: string;
  deleteCorpora: boolean;
}): Promise<void> => invoke('delete_corpus_set', params);

export const emitExportCancelRequestedEvent = (): Promise<void> =>
  emit('export_cancel_requested');

export const emitImportCancelRequestedEvent = (): Promise<void> =>
  emit('import_cancel_requested');

export const exportMatches = async (
  params: {
    corpusNames: string[];
    aqlQuery: string;
    queryLanguage: QueryLanguage;
    exportColumns: ExportColumn[];
    exportFormat: ExportFormat;
    outputFile: string;
  },
  handlers: {
    onEvent?: (event: ExportStatusEvent) => void;
  } = {},
): Promise<void> => {
  const eventChannel = new Channel<ExportStatusEvent>();
  if (handlers.onEvent !== undefined) {
    eventChannel.onmessage = handlers.onEvent;
  }
  await invoke('export_matches', { eventChannel, ...params });
};

export const addCorporaToSet = (params: {
  corpusSet: string;
  corpusNames: string[];
}): Promise<void> => invoke('add_corpora_to_set', params);

export const createCorpusSet = (params: { corpusSet: string }): Promise<void> =>
  invoke('create_corpus_set', params);

export const getCorpora = (): Promise<Corpora> => invoke('get_corpora');

export const getDbDir = (): Promise<string> => invoke('get_db_dir');

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

export const importCorpora = async (
  params: {
    paths: string[];
  },
  handlers: {
    onEvent?: (event: ImportStatusEvent) => void;
  } = {},
): Promise<string[]> => {
  const eventChannel = new Channel<ImportStatusEvent>();
  if (handlers.onEvent !== undefined) {
    eventChannel.onmessage = handlers.onEvent;
  }
  return await invoke('import_corpora', { eventChannel, ...params });
};

export const renameCorpusSet = (params: {
  corpusSet: string;
  newCorpusSet: string;
}): Promise<void> => invoke('rename_corpus_set', params);

export const toggleCorpusInSet = (params: {
  corpusSet: string;
  corpusName: string;
}): Promise<void> => invoke('toggle_corpus_in_set', params);

export const validateQuery = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryValidationResult> => invoke('validate_query', params);
