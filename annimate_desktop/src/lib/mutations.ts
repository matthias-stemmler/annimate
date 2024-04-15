import {
  exportMatches,
  subscribeToExportStatus,
  toggleCorpusInSet,
} from '@/lib/api';
import { ExportColumn, QueryLanguage, StatusEvent } from '@/lib/api-types';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import { QUERY_KEY_CORPORA } from '@/lib/queries';

const MUTATION_KEY_EXPORT_MATCHES = 'export-matches';

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
        (statusEvent: StatusEvent) => {
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

export const useToggleCorpusInSetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { corpusSet: string; corpusName: string }) =>
      toggleCorpusInSet(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_CORPORA] });
    },
  });
};
