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
      annoKey: AnnoKey | undefined;
    }
  | {
      type: 'anno_document';
      annoKey: AnnoKey | undefined;
    }
  | {
      type: 'anno_match';
      annoKey: AnnoKey | undefined;
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

export type UnlistenFn = () => void;
