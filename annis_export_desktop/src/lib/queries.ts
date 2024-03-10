import {
  getCorpusNames,
  getExportableAnnoKeys,
  getQueryNodes,
  validateQuery,
} from '@/lib/api';
import {
  ExportableAnnoKeys,
  QueryLanguage,
  QueryNodesResult,
  QueryValidationResult,
} from '@/lib/api-types';
import {
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

const QUERY_KEY_CORPUS_NAMES = 'corpus-names';
const QUERY_KEY_QUERY_NODES = 'query-nodes';
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

const queryNodesQueryConfig = (params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}) => ({
  queryKey: [QUERY_KEY_QUERY_NODES, params],
  queryFn: () => getQueryNodes(params),
});

export const useQueryNodesQuery = (params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): UseQueryResult<QueryNodesResult> => useQuery(queryNodesQueryConfig(params));

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

export const useExportableAnnoKeysQuery = (params: {
  corpusNames: string[];
}): UseQueryResult<ExportableAnnoKeys> =>
  useQuery(exportableAnnoKeysQueryConfig(params));

export const useGetExportableAnnoKeysQueryData = (): ((params: {
  corpusNames: string[];
}) => Promise<ExportableAnnoKeys>) => {
  const queryClient = useQueryClient();
  return (params: { corpusNames: string[] }) =>
    queryClient.ensureQueryData(exportableAnnoKeysQueryConfig(params));
};

export const useGetQueryNodesQueryData = (): ((params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}) => Promise<QueryNodesResult>) => {
  const queryClient = useQueryClient();
  return (params: { aqlQuery: string; queryLanguage: QueryLanguage }) =>
    queryClient.ensureQueryData(queryNodesQueryConfig(params));
};
