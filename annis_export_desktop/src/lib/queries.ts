import { fetchCorpusNames, validateQuery } from '@/lib/api';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export const useCorpusNames = (): UseQueryResult<string[]> =>
  useQuery({
    queryKey: ['corpusNames'],
    queryFn: fetchCorpusNames,
  });

export const useQueryValidationResult = (
  corpusNames: string[],
  aqlQuery: string,
): UseQueryResult<string> =>
  useQuery({
    queryKey: ['queryValidationResult', corpusNames, aqlQuery],
    queryFn: () => validateQuery(corpusNames, aqlQuery),
  });
