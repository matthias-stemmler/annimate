export type {
  OpenDialogOptions,
  SaveDialogOptions,
} from '@tauri-apps/api/dialog';

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

export type ExportColumn =
  | {
      type: 'number';
    }
  | {
      type: 'anno_corpus';
      annoKey: AnnoKey | undefined;
    }
  | {
      type: 'anno_document';
      annoKey: AnnoKey | undefined;
    }
  | {
      type: 'anno_match';
      annoKey: AnnoKey | undefined;
      nodeRef: QueryNodeRef | undefined;
    }
  | {
      type: 'match_in_context';
      context: number;
      contextRightOverride: number | undefined;
      primaryNodeRefs: QueryNodeRef[];
      secondaryNodeRefs: QueryNodeRef[];
      segmentation: string | undefined;
    };

export type ExportColumnType = ExportColumn['type'];
export type ExportColumnData<T extends ExportColumnType> = Omit<
  ExportColumn & { type: T },
  'type'
>;

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
  | { type: 'found'; count: number }
  | { type: 'exported'; progress: number };

export type ImportStatusEvent =
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
