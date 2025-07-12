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
  ExportSpec,
  ExportStatusEvent,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  ImportCorpus,
  ImportCorpusResult,
  ImportStatusEvent,
  OpenDialogOptions,
  OpenDialogReturn,
  Project,
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

const CORPUS_NO_MATCHES = 'Corpus without matches';
const CORPUS_MANY_MATCHES = 'Corpus with many matches';
const CORPUS_NO_ANNO_KEYS = 'Corpus without anno keys';
const CORPUS_MANY_ANNO_KEYS = 'Corpus with many anno keys';
const CORPUS_MULTIPLE_SEGMENTATIONS = 'Corpus with multiple segmentations';
const CORPUS_SLOW = 'Corpus with slow segmentations/anno keys';

const CORPUS_FAILING_EXPORT = 'Corpus with failing export';
const CORPUS_FAILING_ANNO_KEYS = 'Corpus with failing anno keys';
const CORPUS_FAILING_TOGGLE = 'Corpus that fails to toggle';
const CORPUS_FAILING_DELETE = 'Corpus that fails to delete';

const CORPUS_SET_NORMAL = 'Normal';
const CORPUS_SET_WORKING = 'Working';
const CORPUS_SET_FAILING = 'Failing';

const NS_CORPUS = 'corpus';
const NS_DOCUMENT = 'doc';
const NS_NODE = 'node';

const SEGMENTATION1 = 'segmentation1';
const SEGMENTATION2 = 'segmentation2';
const SEGMENTATION3 = 'segmentation3';

let corpusNames = [
  CORPUS_NORMAL,
  CORPUS_NO_MATCHES,
  CORPUS_MANY_MATCHES,
  CORPUS_NO_ANNO_KEYS,
  CORPUS_MANY_ANNO_KEYS,
  CORPUS_MULTIPLE_SEGMENTATIONS,
  CORPUS_SLOW,
  CORPUS_FAILING_EXPORT,
  CORPUS_FAILING_ANNO_KEYS,
  CORPUS_FAILING_TOGGLE,
  CORPUS_FAILING_DELETE,
];

const corpusSets: Record<string, { corpusNames: string[] }> = {
  [CORPUS_SET_NORMAL]: {
    corpusNames: [CORPUS_NORMAL],
  },
  [CORPUS_SET_WORKING]: {
    corpusNames: [
      CORPUS_NORMAL,
      CORPUS_NO_MATCHES,
      CORPUS_MANY_MATCHES,
      CORPUS_NO_ANNO_KEYS,
      CORPUS_MANY_ANNO_KEYS,
      CORPUS_MULTIPLE_SEGMENTATIONS,
      CORPUS_SLOW,
    ],
  },
  [CORPUS_SET_FAILING]: {
    corpusNames: [
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
      displayName: `${NS_CORPUS}:anno_${i}`,
    });
    doc.push({
      annoKey: { ns: 'doc', name: `anno_${i}` },
      displayName: `${NS_DOCUMENT}:anno_${i}`,
    });
    node.push({
      annoKey: { ns: 'node', name: `anno_${i}` },
      displayName: `${NS_NODE}:anno_${i}`,
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

export const documentDir = async (): Promise<string> => 'mock/document_dir';

export const downloadDir = async (): Promise<string> => 'mock/download_dir';

export const exit = async (exitCode?: number): Promise<void> => {
  logAction('Exit', COLOR_BUILTIN_COMMAND, { exitCode });
  alert(`Exit\nexitCode: ${exitCode}`);
};

export const open = async <T extends OpenDialogOptions>(
  options?: T,
): Promise<OpenDialogReturn<T>> => {
  logAction('File Open', COLOR_BUILTIN_COMMAND, options);

  return options?.multiple
    ? ((await openMultiple(options)) as OpenDialogReturn<T>)
    : ((await openSingle(options)) as OpenDialogReturn<T>);
};

const openSingle = async (
  options?: OpenDialogOptions,
): Promise<string | null> =>
  prompt(
    `File Open - ${options?.defaultPath} - ${options?.filters?.[0].name}\nEnter file path:`,
  );

const openMultiple = async (
  options?: OpenDialogOptions,
): Promise<string[] | null> => {
  const answer = prompt(
    `File Open - ${options?.defaultPath} - ${options?.filters?.[0].name}\nEnter file paths (comma-separated):`,
  );
  if (answer === null) {
    return null;
  }
  return answer === '' ? [] : answer.split(',');
};

export const openPath = async (
  path: string,
  openWith?: string,
): Promise<void> => {
  logAction('Open Path', COLOR_BUILTIN_COMMAND, { path, openWith });
  alert(`Open Path\npath: ${path}\nopenWith: ${openWith}`);
};

export const openUrl = async (
  url: string | URL,
  openWith?: string,
): Promise<void> => {
  logAction('Open URL', COLOR_BUILTIN_COMMAND, { url, openWith });
  alert(`Open URL\nurl: ${url}\nopenWith: ${openWith}`);
};

export const relaunch = async (): Promise<void> => {
  window.location.reload();
};

export const revealItemInDir = async (path: string): Promise<unknown> => {
  logAction('Reveal Item in Dir', COLOR_BUILTIN_COMMAND, { path });
  alert(`Reveal Item in Dir\npath: ${path}`);
  return undefined;
};

export const save = async (
  options?: SaveDialogOptions,
): Promise<string | null> => {
  logAction('Save', COLOR_BUILTIN_COMMAND, options);
  return prompt(
    `Save - ${options?.defaultPath} - ${options?.filters?.[0].name}\nEnter file path:`,
  );
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
    spec: ExportSpec;
    outputFile: string;
  },
  handlers: {
    onEvent?: (event: ExportStatusEvent) => void;
  } = {},
): Promise<void> => {
  logAction('Export', COLOR_CUSTOM_COMMAND, params);

  let cancelRequested = false;

  const unsubscribe = subscribeToExportCancelRequestedEvent(() => {
    cancelRequested = true;
  });

  handlers.onEvent?.({ type: 'started' });

  try {
    const matchCount = params.spec.corpusNames.reduce(
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
        params.spec.corpusNames.includes(CORPUS_FAILING_EXPORT)
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

export const getDbDir = async (): Promise<string> => 'mock/db_dir';

export const getExportableAnnoKeys = async (params: {
  corpusNames: string[];
}): Promise<ExportableAnnoKeys> => {
  if (params.corpusNames.includes(CORPUS_SLOW)) {
    await sleep(1500);
  }

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
  if (params.aqlQuery.includes('$')) {
    await sleep(1500);
  }

  if (params.aqlQuery === '') {
    return { type: 'valid', nodes: [] };
  }

  if (!isQueryValid(params.aqlQuery, params.queryLanguage)) {
    return { type: 'invalid' };
  }

  let variable = 0;
  const nodesWithIndex = params.aqlQuery
    .split(/\s*\|\s*/)
    .flatMap((alternative) =>
      alternative
        .split(/\s*&\s*/)
        .map((queryFragment, index): [QueryNode, number] => {
          variable++;
          return [{ queryFragment, variable: variable.toString() }, index];
        }),
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

  if (params.corpusNames.includes(CORPUS_SLOW)) {
    await sleep(1500);
  }

  return params.corpusNames.length === 1 &&
    params.corpusNames[0] === CORPUS_MULTIPLE_SEGMENTATIONS
    ? [SEGMENTATION1, SEGMENTATION2, SEGMENTATION3]
    : [''];
};

// Special cases:
// - `paths` includes 'fail': Error
// - `paths` includes 'fast': Fast import
// - `paths` is empty:        No corpora found
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

  handlers.onEvent?.({ type: 'started' });

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

// Special cases:
// - `inputFile`='fail':           Error
// - `inputFile`='empty':          Empty project
// - `inputFile`='invalid-query':  Project with invalid query
// - `inputFile`='missing-corpus': Project with missing corpus
export const loadProject = async (params: {
  inputFile: string;
}): Promise<Project> => {
  logAction('Load project', COLOR_CUSTOM_COMMAND, params);

  if (params.inputFile === 'fail') {
    throw new Error('Invalid file');
  }

  if (params.inputFile === 'empty') {
    return {
      corpusSet: '',
      spec: {
        corpusNames: [],
        aqlQuery: '',
        queryLanguage: 'AQLQuirksV3',
        exportColumns: [],
        exportFormat: 'xlsx',
      },
    };
  }

  if (params.inputFile === 'invalid-query') {
    return {
      corpusSet: CORPUS_SET_WORKING,
      spec: {
        corpusNames: [CORPUS_MULTIPLE_SEGMENTATIONS],
        aqlQuery: 'invalid!!',
        queryLanguage: 'AQLQuirksV3',
        exportColumns: [
          { type: 'number' },
          { type: 'anno_corpus', annoKey: { ns: NS_CORPUS, name: 'anno_1' } },
          {
            type: 'anno_document',
            annoKey: { ns: NS_DOCUMENT, name: 'anno_1' },
          },
          {
            type: 'anno_match',
            annoKey: { ns: NS_NODE, name: 'anno_1' },
          },
          {
            type: 'match_in_context',
            segmentation: SEGMENTATION1,
            context: 5,
            contextRightOverride: 10,
            primaryNodeRefs: [],
            secondaryNodeRefs: [],
          },
        ],
        exportFormat: 'xlsx',
      },
    };
  }

  return {
    corpusSet: CORPUS_SET_WORKING,
    spec: {
      corpusNames: [
        CORPUS_MULTIPLE_SEGMENTATIONS,
        ...(params.inputFile === 'missing-corpus'
          ? ['Nonexistent corpus']
          : []),
      ],
      aqlQuery: 'foo="bar" & baz="qux"',
      queryLanguage: 'AQLQuirksV3',
      exportColumns: [
        { type: 'number' },
        { type: 'anno_corpus', annoKey: { ns: NS_CORPUS, name: 'anno_1' } },
        { type: 'anno_document', annoKey: { ns: NS_DOCUMENT, name: 'anno_1' } },
        {
          type: 'anno_match',
          annoKey: { ns: NS_NODE, name: 'anno_1' },
          nodeRef: { index: 1, variables: ['2'] },
        },
        {
          type: 'match_in_context',
          segmentation: SEGMENTATION1,
          context: 5,
          contextRightOverride: 10,
          primaryNodeRefs: [
            {
              index: 1,
              variables: ['2'],
            },
          ],
          secondaryNodeRefs: [{ index: 0, variables: ['1'] }],
        },
      ],
      exportFormat: 'xlsx',
    },
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

export const saveProject = async (params: {
  project: Project;
  outputFile: string;
}): Promise<void> => {
  logAction('Save project', COLOR_CUSTOM_COMMAND, params);
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
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): Promise<QueryValidationResult> => {
  if (params.aqlQuery.includes('$')) {
    await sleep(1500);
  }

  const error = getQueryValidationError(params.aqlQuery, params.queryLanguage);
  return error === undefined
    ? { type: 'valid' }
    : { type: 'invalid', ...error };
};

const isQueryValid = (
  aqlQuery: string,
  queryLanguage: QueryLanguage,
): boolean => getQueryValidationError(aqlQuery, queryLanguage) === undefined;

const getQueryValidationError = (
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
