import {
  getCorpora,
  getDbDir,
  getExportableAnnoKeys,
  getQueryNodes,
  getSegmentations,
  validateQuery,
} from '@/lib/api';
import {
  Corpora,
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

export const QUERY_KEY_CORPORA = 'corpora';
export const QUERY_KEY_DB_DIR = 'db-dir';
export const QUERY_KEY_QUERY_NODES = 'query-nodes';
export const QUERY_KEY_QUERY_VALIDATION_RESULT = 'query-validation-result';
export const QUERY_KEY_SEGMENTATIONS = 'segmentations';
export const QUERY_KEY_EXPORTABLE_ANNO_KEYS = 'exportable-anno-keys';

const corporaQueryConfig = () => ({
  queryKey: [QUERY_KEY_CORPORA],
  queryFn: getCorpora,
});

export const useCorporaQuery = <T>(
  select: (corpora: Corpora) => T,
): UseQueryResult<T> =>
  useQuery({
    ...corporaQueryConfig(),
    select,
  });

export const useGetCorporaQueryData = (): (() => Promise<Corpora>) => {
  const queryClient = useQueryClient();
  return () => queryClient.ensureQueryData(corporaQueryConfig());
};

export const useDbDirQuery = (): UseQueryResult<string> =>
  useQuery({
    queryKey: [QUERY_KEY_DB_DIR],
    queryFn: getDbDir,
  });

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

export const segmentationsQueryConfig = (params: {
  corpusNames: string[];
}) => ({
  queryKey: [QUERY_KEY_SEGMENTATIONS, params],
  queryFn: () => getSegmentations(params),
});

export const useSegmentationsQuery = (params: {
  corpusNames: string[];
}): UseQueryResult<string[]> => useQuery(segmentationsQueryConfig(params));

export const useGetSegmentationsQueryData = (): ((params: {
  corpusNames: string[];
}) => Promise<string[]>) => {
  const queryClient = useQueryClient();
  return (params: { corpusNames: string[] }) =>
    queryClient.ensureQueryData(segmentationsQueryConfig(params));
};

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
