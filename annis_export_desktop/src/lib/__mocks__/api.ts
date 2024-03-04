// Mock version of api.ts
// This enables testing of the app in a real browser without Tauri
// Enable by setting the environment variable `MOCK=1`

import {
  ExportColumn,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  QueryLanguage,
  QueryValidationResult,
  StatusEvent,
  UnlistenFn,
} from '@/lib/api-types';

const COLOR_BUILTIN_COMMAND = '#93c5fd';
const COLOR_CUSTOM_COMMAND = '#86efac';
const COLOR_SUBSCRIPTION = '#d8b4fe';

const CORPUS_NORMAL = 'Normal corpus';
const CORPUS_INVALID_QUERY = 'Corpus with ! resp. !! invalid';
const CORPUS_NO_MATCHES = 'Corpus without matches';
const CORPUS_MANY_MATCHES = 'Corpus with many matches';
const CORPUS_FAILING_EXPORT = 'Corpus with failing export';
const CORPUS_NO_ANNO_KEYS = 'Corpus without anno keys';
const CORPUS_MANY_ANNO_KEYS = 'Corpus with many anno keys';
const CORPUS_FAILING_ANNO_KEYS = 'Corpus with failing anno keys';

const getMatchCountForCorpus = (corpusName: string): number => {
  switch (corpusName) {
    case CORPUS_NO_MATCHES:
      return 0;
    case CORPUS_MANY_MATCHES:
      return 1000;
    default:
      return 123;
  }
};

const makeExportableAnnoKeys = (count: number): ExportableAnnoKeys => {
  const corpus: ExportableAnnoKey[] = [];
  const doc: ExportableAnnoKey[] = [];
  const node: ExportableAnnoKey[] = [];

  for (let i = 0; i < count; i++) {
    corpus.push({
      annoKey: { ns: 'corpus', name: `anno_${i}` },
      displayName: `corpus:anno_${i}`,
    });
    doc.push({
      annoKey: { ns: 'doc', name: `anno_${i}` },
      displayName: `doc:anno_${i}`,
    });
    node.push({
      annoKey: { ns: 'node', name: `anno_${i}` },
      displayName: `node:anno_${i}`,
    });
  }

  return { corpus, doc, node };
};

const exportStatusListeners: Set<(statusEvent: StatusEvent) => void> =
  new Set();

export const dirname = async (path: string): Promise<string> =>
  `<Dirname of ${path}>`;

export const open = async (path: string, openWith?: string): Promise<void> => {
  logAction('Open', COLOR_BUILTIN_COMMAND, { path, openWith });
  alert(`Open\npath: ${path}\nopenWith: ${openWith}`);
};

export const relaunch = async (): Promise<void> => {
  window.location.reload();
};

export const save = async (): Promise<string | null> => {
  logAction('Save', COLOR_BUILTIN_COMMAND);
  return prompt('Save\nEnter file path:');
};

export const exportMatches = async (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  exportColumns: ExportColumn[];
  outputFile: string;
}): Promise<void> => {
  logAction('Export', COLOR_CUSTOM_COMMAND, params);

  const matchCount = params.corpusNames.reduce(
    (acc, c) => acc + getMatchCountForCorpus(c),
    0,
  );

  await sleep(500);
  emitExportStatusEvent({ type: 'found', count: matchCount });

  for (let i = 0; i <= matchCount; i++) {
    await sleep(20);
    emitExportStatusEvent({ type: 'exported', progress: i / matchCount });

    if (
      i >= matchCount / 2 &&
      params.corpusNames.includes(CORPUS_FAILING_EXPORT)
    ) {
      throw new Error('Export failed');
    }
  }
};

export const getCorpusNames = async (): Promise<string[]> => [
  CORPUS_NORMAL,
  CORPUS_INVALID_QUERY,
  CORPUS_NO_MATCHES,
  CORPUS_MANY_MATCHES,
  CORPUS_FAILING_EXPORT,
  CORPUS_NO_ANNO_KEYS,
  CORPUS_MANY_ANNO_KEYS,
  CORPUS_FAILING_ANNO_KEYS,
];

export const getExportableAnnoKeys = async (params: {
  corpusNames: string[];
}): Promise<ExportableAnnoKeys> => {
  if (params.corpusNames.includes(CORPUS_FAILING_ANNO_KEYS)) {
    throw new Error('Failed to get exportable anno keys');
  }

  if (params.corpusNames.includes(CORPUS_MANY_ANNO_KEYS)) {
    return makeExportableAnnoKeys(20);
  }

  if (params.corpusNames.some((c) => c !== CORPUS_NO_ANNO_KEYS)) {
    return makeExportableAnnoKeys(5);
  }

  return makeExportableAnnoKeys(0);
};

export const validateQuery = async (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryValidationResult> => {
  if (params.corpusNames.length === 0) {
    return { type: 'indeterminate' };
  }

  if (!params.corpusNames.includes(CORPUS_INVALID_QUERY)) {
    return { type: 'valid' };
  }

  const failingString = params.queryLanguage === 'AQL' ? '!' : '!!';
  const lines = params.aqlQuery.split('\n');

  const line = lines.findIndex((l) => l.includes(failingString));
  if (line === -1) {
    return { type: 'valid' };
  }

  const column = lines[line].indexOf(failingString);
  if (column === -1) {
    return { type: 'valid' };
  }

  return {
    type: 'invalid',
    desc: `Query must not contain '${failingString}'`,
    location: {
      start: {
        line: line + 1,
        column: column + 1,
      },
      end: {
        line: line + 1,
        column: column + failingString.length,
      },
    },
  };
};

export const subscribeToExportStatus = async (
  callback: (statusEvent: StatusEvent) => void,
): Promise<UnlistenFn> => {
  exportStatusListeners.add(callback);

  logAction(
    `Subscribed to export status, number of listeners = ${exportStatusListeners.size}`,
    COLOR_SUBSCRIPTION,
  );

  return () => {
    exportStatusListeners.delete(callback);

    logAction(
      `Unsubscribed from export status, number of listeners = ${exportStatusListeners.size}`,
      COLOR_SUBSCRIPTION,
    );
  };
};

const emitExportStatusEvent = (statusEvent: StatusEvent) => {
  exportStatusListeners.forEach((l) => l(statusEvent));
};

const logAction = (name: string, color: string, payload?: unknown) => {
  console.log(
    `%c${name}%c\n${payload === undefined ? '' : '%o'}`,
    `background:${color};padding:0.5rem;margin:0.5rem 0`,
    '',
    ...(payload === undefined ? [] : [payload]),
  );
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
