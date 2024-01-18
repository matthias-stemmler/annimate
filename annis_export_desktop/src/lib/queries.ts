import { fetchCorpusNames } from '@/lib/api';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export const useCorpusNames = (): UseQueryResult<string[]> =>
  useQuery({
    queryKey: ['corpusNames'],
    queryFn: fetchCorpusNames,
  });
