// Mock version of api.ts
// This enables testing of the app in a real browser without Tauri
//
// Enable by setting the `VITE_MOCK` environment variable
// Use these values for testing special cases:
// - `VITE_MOCK=update`: Update available
// - `VITE_MOCK=update-fail-fetch`: Cannot fetch update
// - `VITE_MOCK=update-fail-download`: Cannot download update
// - `VITE_MOCK=update-fail-install`: Cannot install update

import {
  AQLError,
  CheckOptions,
  Corpora,
  DownloadEvent,
  DownloadOptions,
  ExportColumn,
  ExportFormat,
  ExportStatusEvent,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  ImportCorpus,
  ImportCorpusResult,
  ImportStatusEvent,
  OpenDialogOptions,
  OpenDialogReturn,
  QueryLanguage,
  QueryNode,
  QueryNodesResult,
  QueryValidationResult,
  SaveDialogOptions,
  UnlistenFn,
  Update,
} from '@/lib/api-types';
import mockReleaseNotes from './mock-release-notes.md?raw';

const COLOR_BUILTIN_COMMAND = '#93c5fd';
const COLOR_CUSTOM_COMMAND = '#86efac';

const CORPUS_NORMAL = 'Normal corpus';
const CORPUS_INVALID_QUERY = 'Corpus with any query invalid';
const CORPUS_NO_MATCHES = 'Corpus without matches';
const CORPUS_MANY_MATCHES = 'Corpus with many matches';
const CORPUS_FAILING_EXPORT = 'Corpus with failing export';
const CORPUS_NO_ANNO_KEYS = 'Corpus without anno keys';
const CORPUS_MANY_ANNO_KEYS = 'Corpus with many anno keys';
const CORPUS_MULTIPLE_SEGMENTATIONS = 'Corpus with multiple segmentations';
const CORPUS_FAILING_ANNO_KEYS = 'Corpus with failing anno keys';
const CORPUS_FAILING_TOGGLE = 'Corpus that fails to toggle';
const CORPUS_FAILING_DELETE = 'Corpus that fails to delete';

let corpusNames = [
  CORPUS_NORMAL,
  CORPUS_INVALID_QUERY,
  CORPUS_NO_MATCHES,
  CORPUS_MANY_MATCHES,
  CORPUS_FAILING_EXPORT,
  CORPUS_NO_ANNO_KEYS,
  CORPUS_MANY_ANNO_KEYS,
  CORPUS_MULTIPLE_SEGMENTATIONS,
  CORPUS_FAILING_ANNO_KEYS,
  CORPUS_FAILING_TOGGLE,
  CORPUS_FAILING_DELETE,
];

const corpusSets: Record<string, { corpusNames: string[] }> = {
  Normal: {
    corpusNames: [CORPUS_NORMAL],
  },
  Working: {
    corpusNames: [
      CORPUS_NORMAL,
      CORPUS_NO_MATCHES,
      CORPUS_MANY_MATCHES,
      CORPUS_NO_ANNO_KEYS,
      CORPUS_MANY_ANNO_KEYS,
      CORPUS_MULTIPLE_SEGMENTATIONS,
    ],
  },
  Failing: {
    corpusNames: [
      CORPUS_INVALID_QUERY,
      CORPUS_FAILING_EXPORT,
      CORPUS_FAILING_ANNO_KEYS,
      CORPUS_FAILING_TOGGLE,
      CORPUS_FAILING_DELETE,
    ],
  },
};

type MockImportCorpus = {
  corpusName: string;
  importCorpus: ImportCorpus;
  result: ImportCorpusResult;
};

const IMPORT_CORPORA: MockImportCorpus[] = [
  {
    corpusName: 'New RelANNIS corpus',
    importCorpus: {
      fileName: '/path/to/new_relannis_corpus',
      format: 'RelANNIS',
      trace: [
        {
          kind: { type: 'archive' },
          path: '/path/to/corpora.zip',
        },
        {
          kind: { type: 'corpus', format: 'RelANNIS' },
          path: '/path/to/new_relannis_corpus',
        },
      ],
    },
    result: {
      type: 'imported',
      name: 'New RelANNIS corpus',
    },
  },
  {
    corpusName: 'Corpus failing to import',
    importCorpus: {
      fileName: '/path/to/corpus_failing_to_import',
      format: 'RelANNIS',
      trace: [
        {
          kind: { type: 'archive' },
          path: '/path/to/corpora.zip',
        },
        {
          kind: { type: 'corpus', format: 'RelANNIS' },
          path: '/path/to/corpus_failing_to_import',
        },
      ],
    },
    result: {
      type: 'failed',
      message: 'This corpus could not be imported',
      cancelled: false,
    },
  },
  {
    corpusName: 'New GraphML corpus',
    importCorpus: {
      fileName: '/path/to/new_graphml_corpus.graphml',
      format: 'GraphML',
      trace: [
        {
          kind: { type: 'archive' },
          path: '/path/to/corpora.zip',
        },
        {
          kind: { type: 'corpus', format: 'GraphML' },
          path: '/path/to/new_graphml_corpus.graphml',
        },
      ],
    },
    result: {
      type: 'imported',
      name: 'New GraphML corpus',
    },
  },
];

window.__ANNIMATE__ = {
  updateEnabled: true,
  versionInfo: {
    annimateVersion: '<mock>',
    graphannisVersion: '<mock>',
  },
};

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

const exportCancelRequestedListeners: Set<() => void> = new Set();

const importCancelRequestedListeners: Set<() => void> = new Set();

export const checkForUpdate = async (
  options?: CheckOptions,
): Promise<Update | null> => {
  logAction('Check for update', COLOR_BUILTIN_COMMAND, options);

  if (/^update-?/.test(import.meta.env.VITE_MOCK ?? '')) {
    await sleep(1000);

    if (import.meta.env.VITE_MOCK === 'update-fail-fetch') {
      // The real `checkForUpdate` function throws strings, so we do the same here
      throw 'Could not connect to update server';
    }

    return new MockUpdate({
      body: mockReleaseNotes,
      currentVersion: '1.1.3',
      date: '2024-10-01 17:01:10.876 +00:00:00',
      version: '1.1.4',
    }) as unknown as Update;
  }

  return null;
};

class MockUpdate {
  private _body?: string;
  private _currentVersion: string;
  private _date?: string;
  private _version: string;

  private closed: boolean = false;

  public get body(): string | undefined {
    this.assertAlive();
    return this._body;
  }

  public get currentVersion(): string {
    this.assertAlive();
    return this._currentVersion;
  }

  public get date(): string | undefined {
    this.assertAlive();
    return this._date;
  }

  public get version(): string {
    this.assertAlive();
    return this._version;
  }

  constructor(data: {
    body?: string;
    currentVersion: string;
    date?: string;
    version: string;
  }) {
    this._body = data.body;
    this._currentVersion = data.currentVersion;
    this._date = data.date;
    this._version = data.version;
  }

  async download(
    onEvent?: (event: DownloadEvent) => void,
    options?: DownloadOptions,
  ): Promise<void> {
    logAction('Download update', COLOR_BUILTIN_COMMAND, options);
    this.assertAlive();

    const contentLength = 1000;

    await sleep(100);
    onEvent?.({
      event: 'Started',
      data: { contentLength },
    });

    for (let i = 0; i < contentLength; i++) {
      await sleep(5);
      onEvent?.({
        event: 'Progress',
        data: { chunkLength: 1 },
      });

      if (
        import.meta.env.VITE_MOCK === 'update-fail-download' &&
        i >= contentLength / 2
      ) {
        // The real `download` method throws strings, so we do the same here
        throw 'Connection lost';
      }
    }

    await sleep(5);
    onEvent?.({
      event: 'Finished',
    });
  }

  async install(): Promise<void> {
    logAction('Install update', COLOR_BUILTIN_COMMAND);
    this.assertAlive();

    await sleep(1000);

    if (import.meta.env.VITE_MOCK === 'update-fail-install') {
      // The real `install` method throws strings, so we do the same here
      throw 'Installer could not be launched';
    }

    await sleep(1000);
  }

  async close(): Promise<void> {
    logAction('Close update', COLOR_BUILTIN_COMMAND);
    this.closed = true;
  }

  private assertAlive() {
    if (this.closed) {
      throw new Error('Update is already closed');
    }
  }
}

export const dirname = async (path: string): Promise<string> =>
  `<Dirname of ${path}>`;

export const exit = async (exitCode?: number): Promise<void> => {
  logAction('Exit', COLOR_BUILTIN_COMMAND, { exitCode });
  alert(`Exit\nexitCode: ${exitCode}`);
};

export const fileOpen = async <T extends OpenDialogOptions>(
  options?: T,
): Promise<OpenDialogReturn<T>> => {
  logAction('File Open', COLOR_BUILTIN_COMMAND, options);

  return options?.multiple
    ? ((await fileOpenMultiple()) as OpenDialogReturn<T>)
    : ((await fileOpenSingle()) as OpenDialogReturn<T>);
};

const fileOpenSingle = async (): Promise<string | null> =>
  prompt('File Open\nEnter file path:');

const fileOpenMultiple = async (): Promise<string[] | null> => {
  const answer = prompt('File Open\nEnter file paths (comma-separated):');
  if (answer === null) {
    return null;
  }
  return answer === '' ? [] : answer.split(',');
};

export const relaunch = async (): Promise<void> => {
  window.location.reload();
};

export const save = async (
  options?: SaveDialogOptions,
): Promise<string | null> => {
  logAction('Save', COLOR_BUILTIN_COMMAND, options);
  return prompt(`Save - ${options?.filters?.[0].name}\nEnter file path:`);
};

export const shellOpen = async (
  path: string,
  openWith?: string,
): Promise<void> => {
  logAction('Shell Open', COLOR_BUILTIN_COMMAND, { path, openWith });
  alert(`Shell Open\npath: ${path}\nopenWith: ${openWith}`);
};

export const addCorporaToSet = async (params: {
  corpusSet: string;
  corpusNames: string[];
}): Promise<void> => {
  logAction('Add corpora to set', COLOR_CUSTOM_COMMAND, params);

  if (corpusNames.length === 0) {
    return;
  }

  corpusSets[params.corpusSet] = corpusSets[params.corpusSet] ?? {
    corpusNames: [],
  };

  corpusSets[params.corpusSet].corpusNames.push(...params.corpusNames);
};

export const createCorpusSet = async (params: {
  corpusSet: string;
}): Promise<void> => {
  logAction('Create corpus set', COLOR_CUSTOM_COMMAND, params);

  corpusSets[params.corpusSet] = { corpusNames: [] };
};

export const deleteCorpus = async (params: {
  corpusName: string;
}): Promise<void> => {
  logAction('Delete corpus', COLOR_CUSTOM_COMMAND, params);

  if (params.corpusName === CORPUS_FAILING_DELETE) {
    throw new Error('This corpus cannot be deleted.');
  }

  corpusNames = corpusNames.filter((c) => c !== params.corpusName);
  for (const corpusSet of Object.values(corpusSets)) {
    corpusSet.corpusNames = corpusSet.corpusNames.filter(
      (c) => c !== params.corpusName,
    );
  }
};

export const deleteCorpusSet = async (params: {
  corpusSet: string;
  deleteCorpora: boolean;
}): Promise<void> => {
  logAction('Delete corpus set', COLOR_CUSTOM_COMMAND, params);

  const corpusSet = corpusSets[params.corpusSet];
  if (corpusSet === undefined) {
    return;
  }

  if (params.deleteCorpora) {
    corpusNames = corpusNames.filter((c) => !corpusSet.corpusNames.includes(c));
  }

  delete corpusSets[params.corpusSet];
};

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
  },
): Promise<void> => {
  logAction('Export', COLOR_CUSTOM_COMMAND, params);

  let cancelRequested = false;

  const unsubscribe = subscribeToExportCancelRequestedEvent(() => {
    cancelRequested = true;
  });

  try {
    const matchCount = params.corpusNames.reduce(
      (acc, c) => acc + getMatchCountForCorpus(c),
      0,
    );

    if (cancelRequested) throw new CancelledError();

    await sleep(500);
    handlers.onEvent?.({ type: 'found', count: matchCount });

    for (let i = 0; i <= matchCount; i++) {
      if (cancelRequested) throw new CancelledError();

      await sleep(20);
      handlers.onEvent?.({ type: 'exported', progress: i / matchCount });

      if (
        i >= matchCount / 2 &&
        params.corpusNames.includes(CORPUS_FAILING_EXPORT)
      ) {
        throw new Error('Export failed');
      }
    }
  } finally {
    unsubscribe();
  }
};

export const emitExportCancelRequestedEvent = async () => {
  logAction('Emit export cancel requested event', COLOR_CUSTOM_COMMAND);

  exportCancelRequestedListeners.forEach((l) => l());
};

const subscribeToExportCancelRequestedEvent = (
  callback: () => void,
): UnlistenFn => {
  exportCancelRequestedListeners.add(callback);

  return () => {
    exportCancelRequestedListeners.delete(callback);
  };
};

let corporaFetched = false;

export const getCorpora = async (): Promise<Corpora> => {
  if (!corporaFetched) {
    await sleep(1000);
  }

  corporaFetched = true;

  return {
    corpora: [...corpusNames].sort().map((c) => ({
      name: c,
      includedInSets: Object.entries(corpusSets)
        .filter(([, { corpusNames }]) => corpusNames.includes(c))
        .map(([s]) => s),
    })),
    sets: Object.keys(corpusSets).sort(),
  };
};

export const getDbDir = async (): Promise<string> => 'mock/db/dir';

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

export const getQueryNodes = async (params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryNodesResult> => {
  if (params.aqlQuery === '') {
    return { type: 'valid', nodes: [] };
  }

  if (!isQuerySyntacticallyValid(params.aqlQuery, params.queryLanguage)) {
    return { type: 'invalid' };
  }

  const nodesWithIndex = params.aqlQuery
    .split(/\s*\|\s*/)
    .flatMap((line) =>
      line
        .split(/\s*&\s*/)
        .map((queryFragment, index): [QueryNode, number] => [
          { queryFragment, variable: `${index + 1}` },
          index,
        ]),
    );

  const nodes: QueryNode[][] = [];

  for (
    let index = 0, ns: [QueryNode, number][];
    (ns = nodesWithIndex.filter(([, i]) => i === index)).length > 0;
    index++
  ) {
    nodes.push(ns.map(([n]) => n));
  }

  return { type: 'valid', nodes };
};

export const getSegmentations = async (params: {
  corpusNames: string[];
}): Promise<string[]> => {
  if (params.corpusNames.length === 0) {
    return [];
  }

  return params.corpusNames.length === 1 &&
    params.corpusNames[0] === CORPUS_MULTIPLE_SEGMENTATIONS
    ? ['segmentation1', 'segmentation2', 'segmentation3', '']
    : [''];
};

export const importCorpora = async (
  params: {
    paths: string[];
  },
  handlers: {
    onEvent?: (event: ImportStatusEvent) => void;
  } = {},
): Promise<string[]> => {
  logAction('Import', COLOR_CUSTOM_COMMAND, params);

  let cancelRequested = false;

  const unsubscribe = subscribeToImportCancelRequestedEvent(() => {
    cancelRequested = true;
  });

  try {
    const delay = params.paths.includes('fast') ? 20 : 200;

    for (let j = 0; j < 9; j++) {
      if (cancelRequested) throw new CancelledError();

      await sleep(delay);

      handlers.onEvent?.({
        type: 'message',
        index: null,
        message: `Collecting corpora ...`,
      });
    }

    if (params.paths.includes('fail')) {
      handlers.onEvent?.({
        type: 'message',
        index: null,
        message: 'Failed to find importable corpora!',
      });

      throw new Error('Failed to find importable corpora!');
    }

    if (params.paths.length === 0) {
      handlers.onEvent?.({
        type: 'corpora_found',
        corpora: [],
      });

      return [];
    }

    handlers.onEvent?.({
      type: 'corpora_found',
      corpora: IMPORT_CORPORA.map(({ importCorpus }) => importCorpus),
    });

    const importedCorpusNames = [];

    for (let i = 0; i < IMPORT_CORPORA.length; i++) {
      if (cancelRequested) {
        handlers.onEvent?.({
          type: 'corpus_import_finished',
          index: i,
          result: {
            type: 'failed',
            message: 'Import cancelled',
            cancelled: true,
          },
        });

        continue;
      }

      const { importCorpus, result } = IMPORT_CORPORA[i];

      handlers.onEvent?.({
        type: 'corpus_import_started',
        index: i,
      });

      handlers.onEvent?.({
        type: 'message',
        index: i,
        message: `Importing ${importCorpus.fileName}`,
      });

      for (let j = 0; j < 9; j++) {
        await sleep(delay);

        handlers.onEvent?.({
          type: 'message',
          index: i,
          message: `Still working at ${importCorpus.fileName} ...`,
        });
      }

      await sleep(delay);

      handlers.onEvent?.({
        type: 'message',
        index: i,
        message: `Finished importing ${importCorpus.fileName}`,
      });

      handlers.onEvent?.({
        type: 'corpus_import_finished',
        index: i,
        result,
      });

      if (result.type === 'imported') {
        corpusNames.push(result.name);
        importedCorpusNames.push(result.name);
      }
    }

    return importedCorpusNames;
  } finally {
    unsubscribe();
  }
};

export const emitImportCancelRequestedEvent = async () => {
  logAction('Emit import cancel requested event', COLOR_CUSTOM_COMMAND);

  importCancelRequestedListeners.forEach((l) => l());
};

const subscribeToImportCancelRequestedEvent = (
  callback: () => void,
): UnlistenFn => {
  importCancelRequestedListeners.add(callback);

  return () => {
    importCancelRequestedListeners.delete(callback);
  };
};

export const renameCorpusSet = async (params: {
  corpusSet: string;
  newCorpusSet: string;
}): Promise<void> => {
  logAction('Rename corpus set', COLOR_CUSTOM_COMMAND, params);

  corpusSets[params.newCorpusSet] = corpusSets[params.corpusSet];
  delete corpusSets[params.corpusSet];
};

export const toggleCorpusInSet = async (params: {
  corpusSet: string;
  corpusName: string;
}): Promise<void> => {
  logAction('Toggle corpus in set', COLOR_CUSTOM_COMMAND, params);

  if (params.corpusName === CORPUS_FAILING_TOGGLE) {
    throw new Error('This corpus cannot be toggled.');
  }

  const corpusSet = corpusSets[params.corpusSet];
  if (corpusSet !== undefined) {
    corpusSet.corpusNames = corpusSet.corpusNames.includes(params.corpusName)
      ? corpusSet.corpusNames.filter((c) => c !== params.corpusName)
      : [...corpusSet.corpusNames, params.corpusName];
  }
};

export const validateQuery = async (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryValidationResult> => {
  if (params.corpusNames.includes(CORPUS_INVALID_QUERY)) {
    return {
      type: 'invalid',
      desc: 'Query is semantically invalid',
      location: null,
    };
  }

  const error = getQuerySyntaxError(params.aqlQuery, params.queryLanguage);
  return error === undefined
    ? { type: 'valid' }
    : { type: 'invalid', ...error };
};

const isQuerySyntacticallyValid = (
  aqlQuery: string,
  queryLanguage: QueryLanguage,
): boolean => getQuerySyntaxError(aqlQuery, queryLanguage) === undefined;

const getQuerySyntaxError = (
  aqlQuery: string,
  queryLanguage: QueryLanguage,
): AQLError | undefined => {
  const failingString = queryLanguage === 'AQL' ? '!' : '!!';
  const lines = aqlQuery.split('\n');

  const line = lines.findIndex((l) => l.includes(failingString));
  if (line === -1) {
    return undefined;
  }

  const column = lines[line].indexOf(failingString);
  if (column === -1) {
    return undefined;
  }

  return {
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

class CancelledError extends Error {
  constructor() {
    super('Cancelled');
  }

  cancelled = true;
}
