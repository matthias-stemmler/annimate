import {
  ExportableAnnoKeys,
  QueryLanguage,
  QueryValidationResult,
  getCorpusNames,
  getExportableAnnoKeys,
  validateQuery,
} from '@/lib/api';
import {
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

const QUERY_KEY_CORPUS_NAMES = 'corpus-names';
const QUERY_KEY_QUERY_VALIDATION_RESULT = 'query-validation-result';
const QUERY_KEY_EXPORTABLE_ANNO_KEYS = 'exportable-anno-keys';

export const useCorpusNamesQuery = (): UseQueryResult<string[]> =>
  useQuery({
    queryKey: [QUERY_KEY_CORPUS_NAMES],
    queryFn: getCorpusNames,
  });

export const useGetCorpusNamesQueryData = (): (() => string[] | undefined) => {
  const queryClient = useQueryClient();
  return () => queryClient.getQueryData([QUERY_KEY_CORPUS_NAMES]);
};

export const useQueryValidationResultQuery = (params: {
  corpusNames: string[];
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): UseQueryResult<QueryValidationResult> =>
  useQuery({
    enabled: params.aqlQuery !== '',
    queryKey: [QUERY_KEY_QUERY_VALIDATION_RESULT, params],
    queryFn: () => validateQuery(params),
  });

export const useExportableAnnoKeysQuery = <T>(
  params: {
    corpusNames: string[];
  },
  select: (exportableAnnoKeys: ExportableAnnoKeys) => T,
): UseQueryResult<T> =>
  useQuery({
    queryKey: [QUERY_KEY_EXPORTABLE_ANNO_KEYS, params],
    queryFn: () => getExportableAnnoKeys(params),
    select,
  });

export const useGetExportableAnnoKeysQueryData = (): ((params: {
  corpusNames: string[];
}) => ExportableAnnoKeys | undefined) => {
  const queryClient = useQueryClient();
  return (params: { corpusNames: string[] }) =>
    queryClient.getQueryData([QUERY_KEY_EXPORTABLE_ANNO_KEYS, params]);
};
