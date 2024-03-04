import {
  getCorpusNames,
  getExportableAnnoKeys,
  validateQuery,
} from '@/lib/api';
import {
  ExportableAnnoKeys,
  QueryLanguage,
  QueryValidationResult,
} from '@/lib/api-types';
import {
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

const QUERY_KEY_CORPUS_NAMES = 'corpus-names';
const QUERY_KEY_QUERY_VALIDATION_RESULT = 'query-validation-result';
const QUERY_KEY_EXPORTABLE_ANNO_KEYS = 'exportable-anno-keys';

const corpusNamesQueryConfig = () => ({
  queryKey: [QUERY_KEY_CORPUS_NAMES],
  queryFn: getCorpusNames,
});

export const useCorpusNamesQuery = (): UseQueryResult<string[]> =>
  useQuery(corpusNamesQueryConfig());

export const useGetCorpusNamesQueryData = (): (() => Promise<string[]>) => {
  const queryClient = useQueryClient();
  return () => queryClient.ensureQueryData(corpusNamesQueryConfig());
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

const exportableAnnoKeysQueryConfig = (params: { corpusNames: string[] }) => ({
  queryKey: [QUERY_KEY_EXPORTABLE_ANNO_KEYS, params],
  queryFn: () => getExportableAnnoKeys(params),
});

export const useExportableAnnoKeysQuery = <T>(
  params: {
    corpusNames: string[];
  },
  select: (exportableAnnoKeys: ExportableAnnoKeys) => T,
): UseQueryResult<T> =>
  useQuery({
    ...exportableAnnoKeysQueryConfig(params),
    select,
  });

export const useGetExportableAnnoKeysQueryData = (): ((params: {
  corpusNames: string[];
}) => Promise<ExportableAnnoKeys>) => {
  const queryClient = useQueryClient();
  return (params: { corpusNames: string[] }) =>
    queryClient.ensureQueryData(exportableAnnoKeysQueryConfig(params));
};
