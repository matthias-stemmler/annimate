import {
  QueryLanguage,
  QueryValidationResult,
  fetchCorpusNames,
  validateQuery,
} from '@/lib/api';
import { useDebounce } from '@/lib/hooks';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export const useCorpusNames = (): UseQueryResult<string[]> =>
  useQuery({
    queryKey: ['corpusNames'],
    queryFn: fetchCorpusNames,
  });

export const useQueryValidationResult = (
  corpusNames: string[],
  aqlQuery: string,
  queryLanguage: QueryLanguage,
): UseQueryResult<QueryValidationResult> => {
  const aqlQueryDebounced = useDebounce(aqlQuery, 300, aqlQuery !== '');

  return useQuery({
    enabled: aqlQueryDebounced !== '',
    queryKey: [
      'queryValidationResult',
      corpusNames,
      aqlQueryDebounced,
      queryLanguage,
    ],
    queryFn: () => validateQuery(corpusNames, aqlQueryDebounced, queryLanguage),
  });
};
