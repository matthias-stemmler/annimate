import { save } from '@tauri-apps/api/dialog';
import { UnlistenFn } from '@tauri-apps/api/event';
import { dirname } from '@tauri-apps/api/path';
import { relaunch } from '@tauri-apps/api/process';
import { open } from '@tauri-apps/api/shell';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

export { dirname, open, relaunch, save };

export type ExportableAnnoKeys = {
  corpus: ExportableAnnoKey[];
  doc: ExportableAnnoKey[];
  node: ExportableAnnoKey[];
};

export type ExportableAnnoKey = {
  annoKey: AnnoKey;
  displayName: string;
};

export type AnnoKey = {
  ns: string;
  name: string;
};

export type ExportColumn =
  | {
      type: 'number';
    }
  | {
      type: 'anno_corpus';
    }
  | {
      type: 'anno_document';
    }
  | {
      type: 'anno_match';
    }
  | {
      type: 'match_in_context';
    };

export type ExportColumnType = ExportColumn['type'];
export type ExportColumnData<T extends ExportColumnType> = Omit<
  ExportColumn & { type: T },
  'type'
>;

export type QueryLanguage = 'AQL' | 'AQLQuirksV3';

export type QueryValidationResult =
  | { type: 'valid' }
  | { type: 'invalid'; desc: string; location: LineColumnRange | null }
  | { type: 'indeterminate' };

export type LineColumnRange = {
  start: LineColumn;
  end: LineColumn | null;
};

export type LineColumn = {
  line: number;
  column: number;
};

export type StatusEvent =
  | { type: 'found'; count: number }
  | { type: 'exported'; progress: number };

export const exportMatches = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
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
