import {
  QueryValidationResult,
  getCorpusNames,
  validateQuery,
} from '@/lib/api';
import { useClientState } from '@/lib/client-state';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export const useCorpusNames = (): UseQueryResult<string[]> =>
  useQuery({
    queryKey: ['corpusNames'],
    queryFn: getCorpusNames,
  });

export const useQueryValidationResult =
  (): UseQueryResult<QueryValidationResult> => {
    const {
      aqlQuery: { debouncedValue: aqlQueryDebounced },
      queryLanguage,
      selectedCorpusNames,
    } = useClientState();

    return useQuery({
      enabled: aqlQueryDebounced !== '',
      queryKey: [
        'queryValidationResult',
        selectedCorpusNames,
        aqlQueryDebounced,
        queryLanguage,
      ],
      queryFn: () =>
        validateQuery({
          corpusNames: selectedCorpusNames,
          aqlQuery: aqlQueryDebounced,
          queryLanguage,
        }),
    });
  };
