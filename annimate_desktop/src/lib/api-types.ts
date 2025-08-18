export type { InvokeArgs } from '@tauri-apps/api/core';
export type {
  OpenDialogOptions,
  OpenDialogReturn,
  SaveDialogOptions,
} from '@tauri-apps/plugin-dialog';
export type {
  CheckOptions,
  DownloadEvent,
  DownloadOptions,
  Update,
} from '@tauri-apps/plugin-updater';

export type Corpora = {
  corpora: Corpus[];
  sets: string[];
};

export type Corpus = {
  name: string;
  includedInSets: string[];
};

export type ExportableAnnoKeys = {
  corpus: ExportableAnnoKey[];
  doc: ExportableAnnoKey[];
  node: ExportableAnnoKey[];
};

export type ExportableAnnoKeyCategory = keyof ExportableAnnoKeys;

export type ExportableAnnoKey = {
  annoKey: AnnoKey;
  displayName: string;
};

export type AnnoKey = {
  ns: string;
  name: string;
};

export type Project = {
  corpusSet: string;
  spec: ExportSpec;
};

export type ExportSpec = {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  exportColumns: ExportColumn[];
  exportFormat: ExportFormat;
};

export type ExportColumn =
  | {
      type: 'number';
    }
  | {
      type: 'anno_corpus';
      annoKey?: AnnoKey;
    }
  | {
      type: 'anno_document';
      annoKey?: AnnoKey;
    }
  | {
      type: 'anno_match';
      annoKey?: AnnoKey;
      nodeRef?: QueryNodeRef;
    }
  | {
      type: 'match_in_context';
      context: number;
      contextRightOverride?: number;
      primaryNodeRefs: QueryNodeRef[];
      secondaryNodeRefs: QueryNodeRef[];
      segmentation?: string;
    };

export type ExportColumnType = ExportColumn['type'];
export type ExportColumnData<T extends ExportColumnType> = Omit<
  ExportColumn & { type: T },
  'type'
>;

export type ExportFormat = 'csv' | 'xlsx';

export type QueryLanguage = 'AQL' | 'AQLQuirksV3';

export type QueryNodesResult =
  | { type: 'valid'; nodes: QueryNode[][] }
  | { type: 'invalid' };

export type QueryNode = {
  queryFragment: string;
  variable: string;
};

export type QueryNodeRef = {
  index: number;
  variables: string[];
};

export type QueryValidationResult =
  | { type: 'valid' }
  | ({ type: 'invalid' } & AQLError);

export type AQLError = {
  desc: string;
  location: LineColumnRange | null;
};

export type LineColumnRange = {
  start: LineColumn;
  end: LineColumn | null;
};

export type LineColumn = {
  line: number;
  column: number;
};

export type ExportStatusEvent =
  | { type: 'started' }
  | { type: 'corpora_searched'; count: number; totalCount: number }
  | { type: 'matches_exported'; count: number; totalCount: number };

export type ImportStatusEvent =
  | {
      type: 'started';
    }
  | {
      type: 'corpora_found';
      corpora: ImportCorpus[];
    }
  | {
      type: 'corpus_import_started';
      index: number;
    }
  | {
      type: 'corpus_import_finished';
      index: number;
      result: ImportCorpusResult;
    }
  | {
      type: 'message';
      index: number | null;
      message: string;
    };

export type ImportCorpus = {
  fileName: string;
  format: ImportFormat;
  trace: FilesystemEntity[];
};

export type ImportFormat = 'RelANNIS' | 'GraphML';

export type FilesystemEntity = {
  kind: FilesystemEntityKind;
  path: string;
};

export type FilesystemEntityKind =
  | { type: 'archive' }
  | { type: 'corpus'; format: ImportFormat };

export type ImportCorpusResult =
  | { type: 'imported'; name: string }
  | { type: 'failed'; message: string; cancelled: boolean };

export type UnlistenFn = () => void;
