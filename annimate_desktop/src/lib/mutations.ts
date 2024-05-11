import {
  addCorporaToSet,
  createCorpusSet,
  deleteCorpus,
  deleteCorpusSet,
  emitExportCancelRequestedEvent,
  emitImportCancelRequestedEvent,
  exportMatches,
  importCorpora,
  renameCorpusSet,
  subscribeToExportStatus,
  subscribeToImportStatus,
  toggleCorpusInSet,
} from '@/lib/api';
import {
  ExportColumn,
  ExportStatusEvent,
  ImportCorpus,
  ImportCorpusResult,
  ImportStatusEvent,
  QueryLanguage,
  UnlistenFn,
} from '@/lib/api-types';
import { QUERY_KEY_CORPORA } from '@/lib/queries';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';

export type CancellableOperationError = Error & { cancelled: boolean };

const MUTATION_KEY_EXPORT_MATCHES = 'export-matches';

export const useAddCorporaToSetMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; corpusNames: string[] }) =>
      addCorporaToSet(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};

export const useCreateCorpusSetMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string }) => createCorpusSet(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};

export const useDeleteCorpusMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusName: string }) => deleteCorpus(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};

export const useDeleteCorpusSetMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; deleteCorpora: boolean }) =>
      deleteCorpusSet(args),
    // Also invalide query on error because a subset of the corpora may have been deleted
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};

export const useExportMatchesMutation = (
  getParams: () => Promise<{
    corpusNames: string[];
    aqlQuery: string;
    queryLanguage: QueryLanguage;
    exportColumns: ExportColumn[];
  }>,
) => {
  const [matchCount, setMatchCount] = useState<number | undefined>();
  const [progress, setProgress] = useState<number | undefined>();

  const [cancelRequested, setCancelRequested] = useState(false);

  const mutation = useMutation<
    void,
    CancellableOperationError,
    { outputFile: string },
    { unsubscribe: UnlistenFn }
  >({
    mutationFn: async (args) => {
      const params = await getParams();
      return exportMatches({ ...params, ...args });
    },
    mutationKey: [MUTATION_KEY_EXPORT_MATCHES],
    onMutate: async () => {
      setCancelRequested(false);
      setMatchCount(undefined);
      setProgress(undefined);

      const unsubscribe = await subscribeToExportStatus(
        (statusEvent: ExportStatusEvent) => {
          if (statusEvent.type === 'found') {
            setMatchCount(statusEvent.count);
          } else if (statusEvent.type === 'exported') {
            setProgress(statusEvent.progress);
          }
        },
      );

      return { unsubscribe };
    },
    onSettled: (_data, _error, _variables, context) => {
      context?.unsubscribe();
    },
  });

  const requestCancel = useCallback(() => {
    emitExportCancelRequestedEvent();
    setCancelRequested(true);
  }, []);

  return { mutation, matchCount, progress, cancelRequested, requestCancel };
};

export const useIsExporting = (): boolean =>
  useIsMutating({ mutationKey: [MUTATION_KEY_EXPORT_MATCHES] }) > 0;

export type ImportCorpusMessage = {
  id: number;
  index: number | null;
  message: string;
};

export type ImportCorpusStatus = {
  importCorpus: ImportCorpus;
} & (
  | { type: 'idle' }
  | { type: 'pending' }
  | { type: 'finished'; result: ImportCorpusResult }
);

export type ImportResult =
  | {
      type: 'imported';
      corpusNames: string[];
    }
  | {
      type: 'failed';
      message: string;
      cancelled: boolean;
    };

const MAX_IMPORT_MESSAGE_COUNT = 1024;

export const useImportCorporaMutation = () => {
  const queryClient = useQueryClient();

  const [corporaStatus, setCorporaStatus] = useState<
    ImportCorpusStatus[] | undefined
  >();
  const [messages, setMessages] = useState<ImportCorpusMessage[]>([]);
  const [result, setResult] = useState<ImportResult | undefined>();

  const [cancelRequested, setCancelRequested] = useState(false);

  const mutation = useMutation<
    string[],
    CancellableOperationError,
    { paths: string[] },
    { unsubscribe: UnlistenFn }
  >({
    mutationFn: importCorpora,
    onMutate: async () => {
      setCancelRequested(false);
      setCorporaStatus(undefined);
      setMessages([]);
      setResult(undefined);

      const unsubscribe = await subscribeToImportStatus(
        (statusEvent: ImportStatusEvent) => {
          if (statusEvent.type === 'corpora_found') {
            setCorporaStatus(
              statusEvent.corpora.map((importCorpus) => ({
                importCorpus,
                type: 'idle',
              })),
            );
          } else if (statusEvent.type === 'corpus_import_started') {
            setCorporaStatus((importCorpora) =>
              (importCorpora ?? []).map((importCorpus, index) =>
                index === statusEvent.index
                  ? {
                      ...importCorpus,
                      type: 'pending',
                    }
                  : importCorpus,
              ),
            );
          } else if (statusEvent.type === 'corpus_import_finished') {
            setCorporaStatus((importCorpora) =>
              (importCorpora ?? []).map((importCorpus, index) =>
                index === statusEvent.index
                  ? {
                      ...importCorpus,
                      type: 'finished',
                      result: statusEvent.result,
                    }
                  : importCorpus,
              ),
            );
          } else if (statusEvent.type === 'message') {
            setMessages((messages) => {
              const lastMessage =
                messages.length === 0
                  ? undefined
                  : messages[messages.length - 1];
              const id = (lastMessage?.id ?? 0) + 1;
              const excessiveMessageCount = Math.max(
                0,
                messages.length + 1 - MAX_IMPORT_MESSAGE_COUNT,
              );

              return [
                ...messages,
                {
                  id,
                  index: statusEvent.index,
                  message: statusEvent.message,
                },
              ].slice(excessiveMessageCount);
            });
          }
        },
      );

      return { unsubscribe };
    },
    onSettled: (_data, _error, _variables, context) => {
      context?.unsubscribe();
    },
    onSuccess: (corpusNames: string[]) => {
      setResult({ type: 'imported', corpusNames });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
    onError: (error: CancellableOperationError) => {
      setResult({
        type: 'failed',
        message: error.message,
        cancelled: error.cancelled,
      });
    },
  });

  const requestCancel = useCallback(() => {
    emitImportCancelRequestedEvent();
    setCancelRequested(true);
  }, []);

  return {
    mutation,
    corporaStatus,
    messages,
    result,
    cancelRequested,
    requestCancel,
  };
};

export const useRenameCorpusSetMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; newCorpusSet: string }) =>
      renameCorpusSet(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};

export const useToggleCorpusInSetMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; corpusName: string }) =>
      toggleCorpusInSet(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });

  return { mutation };
};
