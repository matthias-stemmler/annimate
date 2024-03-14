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

export type StatusEvent =
  | { type: 'found'; count: number }
  | { type: 'exported'; progress: number };

export type UnlistenFn = () => void;
