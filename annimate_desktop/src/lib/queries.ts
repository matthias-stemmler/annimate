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
  DefaultError,
  EnsureQueryDataOptions,
  QueryKey,
  UseQueryResult,
  keepPreviousData,
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

export const useGetCorporaQueryData = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): (() => QueryData<Corpora, Wait>) => {
  const getQueryData = useGetQueryData<Corpora, Wait>(options);
  return () => getQueryData(corporaQueryConfig());
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
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}): UseQueryResult<QueryValidationResult | undefined> =>
  useQuery({
    placeholderData: keepPreviousData,
    queryKey: [QUERY_KEY_QUERY_VALIDATION_RESULT, params],
    queryFn: () => (params.aqlQuery === '' ? null : validateQuery(params)),
    select: (data) => data ?? undefined,
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

export const useGetSegmentationsQueryData = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): ((params: { corpusNames: string[] }) => QueryData<string[], Wait>) => {
  const getQueryData = useGetQueryData<string[], Wait>(options);
  return (params: { corpusNames: string[] }) =>
    getQueryData(segmentationsQueryConfig(params));
};

const exportableAnnoKeysQueryConfig = (params: { corpusNames: string[] }) => ({
  queryKey: [QUERY_KEY_EXPORTABLE_ANNO_KEYS, params],
  queryFn: () => getExportableAnnoKeys(params),
});

export const useExportableAnnoKeysQuery = (params: {
  corpusNames: string[];
}): UseQueryResult<ExportableAnnoKeys> =>
  useQuery(exportableAnnoKeysQueryConfig(params));

export const useGetExportableAnnoKeysQueryData = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): ((params: {
  corpusNames: string[];
}) => QueryData<ExportableAnnoKeys, Wait>) => {
  const getQueryData = useGetQueryData<ExportableAnnoKeys, Wait>(options);
  return (params: { corpusNames: string[] }) =>
    getQueryData(exportableAnnoKeysQueryConfig(params));
};

export const useGetQueryNodesQueryData = <Wait extends boolean = true>(
  options: UseGetQueryDataOptions<Wait> = {},
): ((params: {
  aqlQuery: string;
  queryLanguage: QueryLanguage;
}) => QueryData<QueryNodesResult, Wait>) => {
  const getQueryData = useGetQueryData<QueryNodesResult, Wait>(options);
  return (params: { aqlQuery: string; queryLanguage: QueryLanguage }) =>
    getQueryData(queryNodesQueryConfig(params));
};

export type UseGetQueryDataOptions<Wait extends boolean> = {
  wait?: Wait;
};

type QueryData<T, Wait extends boolean> = Wait extends true
  ? Promise<T>
  : T | undefined;

/**
 * Wrapper around either `queryClient.getQueryData` or `queryClient.ensureQueryData` depending on the given `wait` option.
 * It is meant for cases where we either want to wait for the data (as a `Promise<T>`) or just get the currently available data (as a `T | undefined`), depending on the context.
 */
const useGetQueryData = <T, Wait extends boolean>(
  options: UseGetQueryDataOptions<Wait> = {},
): ((
  queryConfig: EnsureQueryDataOptions<unknown, DefaultError, T, QueryKey>,
) => QueryData<T, Wait>) => {
  const queryClient = useQueryClient();

  return (queryConfig) =>
    (options.wait === false
      ? queryClient.getQueryData(queryConfig.queryKey)
      : queryClient.ensureQueryData(queryConfig)) as QueryData<T, Wait>;
};
