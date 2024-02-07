import { StatusEvent, exportMatches, subscribeToExportStatus } from '@/lib/api';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const MUTATION_KEY_EXPORT_MATCHES = 'export-matches';

export const useExportMatches = () => {
  const [matchCount, setMatchCount] = useState<number | undefined>();
  const [progress, setProgress] = useState<number | undefined>();

  const mutation = useMutation({
    mutationFn: exportMatches,
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
