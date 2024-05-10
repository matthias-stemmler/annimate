// Mock version of api.ts
// This enables testing of the app in a real browser without Tauri
// Enable by setting the environment variable `MOCK=1`

import {
  AQLError,
  Corpora,
  ExportColumn,
  ExportStatusEvent,
  ExportableAnnoKey,
  ExportableAnnoKeys,
  ImportCorpus,
  ImportCorpusResult,
  ImportStatusEvent,
  OpenDialogOptions,
  QueryLanguage,
  QueryNode,
  QueryNodesResult,
  QueryValidationResult,
  SaveDialogOptions,
  UnlistenFn,
} from '@/lib/api-types';

const COLOR_BUILTIN_COMMAND = '#93c5fd';
const COLOR_CUSTOM_COMMAND = '#86efac';
const COLOR_SUBSCRIPTION = '#d8b4fe';

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
      corpus: {
        importedName: 'New RelANNIS corpus',
        conflictingName: null,
      },
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
    corpusName: CORPUS_NORMAL,
    importCorpus: {
      fileName: '/path/to/normal_corpus',
      format: 'RelANNIS',
      trace: [
        {
          kind: { type: 'archive' },
          path: '/path/to/corpora.zip',
        },
        {
          kind: { type: 'archive' },
          path: '/path/to/corpora_inner.zip',
        },
        {
          kind: { type: 'corpus', format: 'RelANNIS' },
          path: '/path/to/normal_corpus',
        },
      ],
    },
    result: {
      type: 'imported',
      corpus: {
        importedName: 'Normal corpus (1)',
        conflictingName: 'Normal corpus',
      },
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
      corpus: {
        importedName: 'New GraphML corpus',
        conflictingName: null,
      },
    },
  },
];

window.__ANNIMATE__ = {
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

const exportStatusListeners: Set<(statusEvent: ExportStatusEvent) => void> =
  new Set();

const importCancelRequestedListeners: Set<() => void> = new Set();

const importStatusListeners: Set<(statusEvent: ImportStatusEvent) => void> =
  new Set();

export const dirname = async (path: string): Promise<string> =>
  `<Dirname of ${path}>`;

export const exit = async (exitCode?: number): Promise<void> => {
  logAction('Exit', COLOR_BUILTIN_COMMAND, { exitCode });
  alert(`Exit\nexitCode: ${exitCode}`);
};

export const fileOpen = async (
  options?: OpenDialogOptions,
): Promise<null | string | string[]> => {
  logAction('File Open', COLOR_BUILTIN_COMMAND, options);
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
  return prompt('Save\nEnter file path:');
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

export const exportMatches = async (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
  exportColumns: ExportColumn[];
  outputFile: string;
}): Promise<void> => {
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
    emitExportStatusEvent({ type: 'found', count: matchCount });

    for (let i = 0; i <= matchCount; i++) {
      if (cancelRequested) throw new CancelledError();

      await sleep(20);
      emitExportStatusEvent({ type: 'exported', progress: i / matchCount });

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
    corpora: corpusNames.map((c) => ({
      name: c,
      includedInSets: Object.entries(corpusSets)
        .filter(([, { corpusNames }]) => corpusNames.includes(c))
        .map(([s]) => s),
    })),
    sets: Object.keys(corpusSets),
  };
};

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

export const importCorpora = async (params: {
  paths: string[];
}): Promise<string[]> => {
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

      emitImportStatusEvent({
        type: 'message',
        index: null,
        message: `Collecting corpora ...`,
      });
    }

    if (params.paths.includes('fail')) {
      emitImportStatusEvent({
        type: 'message',
        index: null,
        message: 'Failed to find importable corpora!',
      });

      throw new Error('Failed to find importable corpora!');
    }

    if (params.paths.length === 0) {
      emitImportStatusEvent({
        type: 'corpora_found',
        corpora: [],
      });

      return [];
    }

    emitImportStatusEvent({
      type: 'corpora_found',
      corpora: IMPORT_CORPORA.map(({ importCorpus }) => importCorpus),
    });

    const importedCorpusNames = [];

    for (let i = 0; i < IMPORT_CORPORA.length; i++) {
      if (cancelRequested) {
        emitImportStatusEvent({
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

      emitImportStatusEvent({
        type: 'corpus_import_started',
        index: i,
      });

      emitImportStatusEvent({
        type: 'message',
        index: i,
        message: `Importing ${importCorpus.fileName}`,
      });

      for (let j = 0; j < 9; j++) {
        await sleep(delay);

        emitImportStatusEvent({
          type: 'message',
          index: i,
          message: `Still working at ${importCorpus.fileName} ...`,
        });
      }

      await sleep(delay);

      emitImportStatusEvent({
        type: 'message',
        index: i,
        message: `Finished importing ${importCorpus.fileName}`,
      });

      emitImportStatusEvent({
        type: 'corpus_import_finished',
        index: i,
        result,
      });

      if (result.type === 'imported') {
        corpusNames.push(result.corpus.importedName);
        importedCorpusNames.push(result.corpus.importedName);
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

export const subscribeToExportStatus = async (
  callback: (statusEvent: ExportStatusEvent) => void,
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

const emitExportStatusEvent = (statusEvent: ExportStatusEvent) => {
  exportStatusListeners.forEach((l) => l(statusEvent));
};

export const subscribeToImportStatus = async (
  callback: (statusEvent: ImportStatusEvent) => void,
): Promise<UnlistenFn> => {
  importStatusListeners.add(callback);

  logAction(
    `Subscribed to import status, number of listeners = ${importStatusListeners.size}`,
    COLOR_SUBSCRIPTION,
  );

  return () => {
    importStatusListeners.delete(callback);

    logAction(
      `Unsubscribed from import status, number of listeners = ${importStatusListeners.size}`,
      COLOR_SUBSCRIPTION,
    );
  };
};

const emitImportStatusEvent = (statusEvent: ImportStatusEvent) => {
  importStatusListeners.forEach((l) => l(statusEvent));
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
