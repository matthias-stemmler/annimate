import {
  deleteCorpus,
  exportMatches,
  importCorpora,
  subscribeToExportStatus,
  toggleCorpusInSet,
} from '@/lib/api';
import {
  ExportColumn,
  ExportStatusEvent,
  QueryLanguage,
} from '@/lib/api-types';
import { QUERY_KEY_CORPORA } from '@/lib/queries';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

const MUTATION_KEY_EXPORT_MATCHES = 'export-matches';

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

  const mutation = useMutation({
    mutationFn: async (args: { outputFile: string }) => {
      const params = await getParams();
      return exportMatches({ ...params, ...args });
    },
    mutationKey: [MUTATION_KEY_EXPORT_MATCHES],
    onMutate: async () => {
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
      setMatchCount(undefined);
      setProgress(undefined);
    },
  });

  return { mutation, matchCount, progress };
};

export const useIsExporting = (): boolean =>
  useIsMutating({ mutationKey: [MUTATION_KEY_EXPORT_MATCHES] }) > 0;

export const useImportCorporaMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { paths: string[] }) => importCorpora(args),
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
