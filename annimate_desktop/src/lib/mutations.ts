import {
  addCorporaToSet,
  createCorpusSet,
  deleteCorpus,
  deleteCorpusSet,
  emitExportCancelRequestedEvent,
  emitImportCancelRequestedEvent,
  exportMatches,
  importCorpora,
  loadProject,
  relaunch,
  renameCorpusSet,
  saveProject,
  setCorpusNamesToPreload,
  toggleCorpusInSet,
} from '@/lib/api';
import {
  DownloadEvent,
  ExportSpec,
  ExportStatusEvent,
  ImportCorpus,
  ImportCorpusResult,
  ImportStatusEvent,
  Project,
  Update,
} from '@/lib/api-types';
import { QUERY_KEY_CORPORA } from '@/lib/queries';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

export class CancellableOperationError extends Error {
  cancelled: boolean;

  constructor(message?: string, cancelled: boolean = true) {
    super(message);
    this.cancelled = cancelled;
  }
}

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

export const useApplyAppUpdateMutation = () => {
  const [progress, setProgress] = useState<number | undefined>();
  const [stage, setStage] = useState<'download' | 'install' | undefined>(
    undefined,
  );

  const mutation = useMutation({
    mutationFn: async (args: { update: Update }) => {
      let downloadedLength: number = 0;
      let totalLength: number | undefined = undefined;

      try {
        await args.update.download((event: DownloadEvent) => {
          switch (event.event) {
            case 'Started':
              totalLength = event.data.contentLength;
              break;

            case 'Progress':
              downloadedLength += event.data.chunkLength;
              if (totalLength !== undefined && totalLength > 0) {
                setProgress(downloadedLength / totalLength);
              }
              break;

            case 'Finished':
              setProgress(1);
              break;
          }
        });
      } catch (err) {
        // Errors returned from `download` are usually strings
        throw new Error(`Failed to download update: ${err}`);
      }

      setProgress(1);
      setStage('install');

      try {
        await args.update.install();
      } catch (err) {
        // Errors returned from `install` are usually strings
        throw new Error(`Failed to install update: ${err}`);
      }

      await relaunch();
    },
    onMutate: () => {
      setProgress(0);
      setStage('download');
    },
  });

  const reset = () => {
    mutation.reset();
    setProgress(undefined);
    setStage(undefined);
  };

  return { mutation, progress, reset, stage };
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

export const useDeleteCorpusMutation = ({
  onSuccess,
}: { onSuccess?: () => Promise<void> } = {}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusName: string }) => deleteCorpus(args),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
      await onSuccess?.();
    },
  });

  return { mutation };
};

export const useDeleteCorpusSetMutation = ({
  onSettled,
}: { onSettled?: () => Promise<void> } = {}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; deleteCorpora: boolean }) =>
      deleteCorpusSet(args),
    // Also invalidate query on error because a subset of the corpora may have been deleted
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
      await onSettled?.();
    },
  });

  return { mutation };
};

export const useExportMatchesMutation = (
  getParams: () => Promise<{ spec: ExportSpec }>,
) => {
  const [matchCount, setMatchCount] = useState<number | undefined>();
  const [progress, setProgress] = useState<number | undefined>();

  const startedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  const mutation = useMutation<
    void,
    CancellableOperationError,
    { outputFile: string }
  >({
    mutationFn: async (args) => {
      const params = await getParams().catch((error) => {
        throw new CancellableOperationError(
          error.message,
          cancelRequestedRef.current,
        );
      });

      return exportMatches(
        { ...params, ...args },
        {
          onEvent: (event: ExportStatusEvent) => {
            if (event.type === 'started') {
              startedRef.current = true;

              if (cancelRequestedRef.current) {
                emitExportCancelRequestedEvent();
              }
            } else if (event.type === 'found') {
              setMatchCount(event.count);
            } else if (event.type === 'exported') {
              setProgress(event.progress);
            }
          },
        },
      );
    },
    mutationKey: [MUTATION_KEY_EXPORT_MATCHES],
    onMutate: () => {
      startedRef.current = false;
      cancelRequestedRef.current = false;
      setCancelRequested(false);
      setMatchCount(undefined);
      setProgress(undefined);
    },
  });

  const requestCancel = useCallback(() => {
    setCancelRequested(true);
    cancelRequestedRef.current = true;

    if (startedRef.current) {
      emitExportCancelRequestedEvent();
    }
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

  const startedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  const mutation = useMutation<
    string[],
    CancellableOperationError,
    { paths: string[] }
  >({
    mutationFn: async (args) =>
      importCorpora(args, {
        onEvent: (event: ImportStatusEvent) => {
          if (event.type === 'started') {
            startedRef.current = true;

            if (cancelRequestedRef.current) {
              emitImportCancelRequestedEvent();
            }
          } else if (event.type === 'corpora_found') {
            setCorporaStatus(
              event.corpora.map((importCorpus) => ({
                importCorpus,
                type: 'idle',
              })),
            );
          } else if (event.type === 'corpus_import_started') {
            setCorporaStatus((importCorpora) =>
              (importCorpora ?? []).map((importCorpus, index) =>
                index === event.index
                  ? {
                      ...importCorpus,
                      type: 'pending',
                    }
                  : importCorpus,
              ),
            );
          } else if (event.type === 'corpus_import_finished') {
            setCorporaStatus((importCorpora) =>
              (importCorpora ?? []).map((importCorpus, index) =>
                index === event.index
                  ? {
                      ...importCorpus,
                      type: 'finished',
                      result: event.result,
                    }
                  : importCorpus,
              ),
            );
          } else if (event.type === 'message') {
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
                  index: event.index,
                  message: event.message,
                },
              ].slice(excessiveMessageCount);
            });
          }
        },
      }),
    onMutate: () => {
      startedRef.current = false;
      cancelRequestedRef.current = false;
      setCancelRequested(false);
      setCorporaStatus(undefined);
      setMessages([]);
      setResult(undefined);
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
    setCancelRequested(true);
    cancelRequestedRef.current = true;

    if (startedRef.current) {
      emitImportCancelRequestedEvent();
    }
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

export const useLoadProjectMutation = <T>(
  processData: (data: { project: Project }) => Promise<T>,
) => {
  const mutation = useMutation({
    mutationFn: async (args: { inputFile: string }) => {
      const project = await loadProject(args);
      return await processData({ project });
    },
  });

  return { mutation };
};

export const useRenameCorpusSetMutation = ({
  onSuccess,
}: {
  onSuccess?: (args: {
    corpusSet: string;
    newCorpusSet: string;
  }) => Promise<void>;
} = {}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { corpusSet: string; newCorpusSet: string }) =>
      renameCorpusSet(args),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
      await onSuccess?.(variables);
    },
  });

  return { mutation };
};

export const useSetCorpusNamesToPreloadMutation = () => {
  const mutation = useMutation({
    mutationFn: (args: { corpusNames: string[] }) =>
      setCorpusNamesToPreload(args),
  });

  return { mutation };
};

export const useSaveProjectMutation = (
  getParams: () => Promise<{
    project: Project;
  }>,
) => {
  const mutation = useMutation({
    mutationFn: async (args: { outputFile: string }) => {
      const params = await getParams();
      return saveProject({ ...params, ...args });
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
