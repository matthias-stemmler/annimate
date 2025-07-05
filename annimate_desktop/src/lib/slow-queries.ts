import {
  DefaultError,
  hashKey,
  keepPreviousData,
  QueryCache,
  QueryCacheNotifyEvent,
  QueryClient,
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      slowTracking: SlowTrackingConfig;
    };
  }
}

export type SlowTrackingConfig = {
  peerQueryKey: QueryKey;
  timeout: number;
};

export type SlowTrackingState = {
  isSlow: boolean;
  observerCount: number;
  timer: number | undefined;
};

type SlowListener = () => void;

/**
 * A query cache that tracks when a query becomes "slow".
 *
 * Usage:
 * ```
 * const queryClient = new QueryClient({
 *   queryCache: new SlowTrackingQueryCache(),
 * });
 *
 * const useMyQuery = (param: string) => useSlowTrackingQuery({
 *   queryKey: ['my-query', param],
 *   queryFn: () => fetchMyQuery(param),
 *   slowTracking: {
 *     peerQueryKey: ['my-query'], // Common prefix of the query keys of all queries ("peers") that are considered "slow" as a group
 *     timeout: 500, // Number of milliseconds after which a query is considered "slow"
 *   },
 * });
 *
 * const { data, isPending, isSlow } = useMyQuery('param');
 * ```
 */
export class SlowTrackingQueryCache extends QueryCache {
  protected slowTrackingStateByHash: Map<string, SlowTrackingState> = new Map();
  protected slowListenersByHash: Map<string, Set<SlowListener>> = new Map();

  constructor() {
    super();

    this.subscribe((event: QueryCacheNotifyEvent) => {
      const slowTrackingConfig = event.query.meta?.slowTracking;
      if (slowTrackingConfig === undefined) {
        return;
      }

      const { peerQueryKey, timeout } = slowTrackingConfig;
      const peerQueryKeyHash = hashKey(peerQueryKey);

      // Observer added -> increase count, adding state if not already present
      if (event.type === 'observerAdded') {
        let state = this.slowTrackingStateByHash.get(peerQueryKeyHash);
        if (state === undefined) {
          state = {
            isSlow: false,
            observerCount: 0,
            timer: undefined,
          };
          this.slowTrackingStateByHash.set(peerQueryKeyHash, state);
        }

        state.observerCount++;
      }

      // Observer removed -> decrease count, removing state if count reaches 0
      if (event.type === 'observerRemoved') {
        const state = this.slowTrackingStateByHash.get(peerQueryKeyHash);
        if (state === undefined) {
          return;
        }

        state.observerCount--;

        if (state.observerCount === 0) {
          if (state.timer !== undefined) {
            window.clearTimeout(state.timer);
          }

          this.slowTrackingStateByHash.delete(peerQueryKeyHash);
        }
      }

      const state = this.slowTrackingStateByHash.get(peerQueryKeyHash);
      if (state === undefined) {
        return;
      }

      if (event.type === 'updated') {
        // Query starting to fetch -> start "slow" timer if not already started
        if (event.action.type === 'fetch' && state.timer === undefined) {
          state.timer = window.setTimeout(() => {
            state.isSlow = true;

            // Rerender all components that use one of the peers
            this.notifySlowListeners(peerQueryKeyHash);
          }, timeout);
        }

        // No more fetching peers -> mark as not slow
        const fetchingPeers = this.findAll({
          queryKey: peerQueryKey,
          fetchStatus: 'fetching',
        });

        if (fetchingPeers.length === 0) {
          if (state.timer !== undefined) {
            window.clearTimeout(state.timer);
            state.timer = undefined;
          }

          state.isSlow = false;
          // No need to notify listeners, as we're currently processing an "updated" event anyway
        }
      }
    });
  }

  public isSlow(peerQueryKey: QueryKey): boolean {
    const peerQueryKeyHash = hashKey(peerQueryKey);
    const state = this.slowTrackingStateByHash.get(peerQueryKeyHash);
    return state?.isSlow ?? false;
  }

  public subscribeSlow(peerQueryKey: QueryKey, listener: SlowListener) {
    const peerQueryKeyHash = hashKey(peerQueryKey);

    let listeners = this.slowListenersByHash.get(peerQueryKeyHash);
    if (listeners === undefined) {
      listeners = new Set();
      this.slowListenersByHash.set(peerQueryKeyHash, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.slowListenersByHash.delete(peerQueryKeyHash);
      }
    };
  }

  private notifySlowListeners(hash: string) {
    const listeners = this.slowListenersByHash.get(hash);
    listeners?.forEach((listener) => listener());
  }
}

export type UseSlowTrackingQueryResult<
  TData = unknown,
  TError = DefaultError,
> = UseQueryResult<TData, TError> & {
  isSlow: boolean;
};

export const useSlowTrackingQuery = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  {
    slowTracking,
    ...options
  }: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    'placeholderData'
  > & { slowTracking: SlowTrackingConfig },
  queryClient?: QueryClient,
): UseSlowTrackingQueryResult<NoInfer<TData>, TError> => {
  const { peerQueryKey } = slowTracking;

  const contextQueryClient = useQueryClient();
  const queryCache = (queryClient ?? contextQueryClient).getQueryCache();

  if (useHasChanged(queryCache)) {
    throw new Error('QueryCache used for useSlowTrackingQuery must not change');
  }

  if (useHasChanged(hashKey(peerQueryKey))) {
    throw new Error(
      'peerQueryKey used for useSlowTrackingQuery must not change',
    );
  }

  if (!(queryCache instanceof SlowTrackingQueryCache)) {
    throw new Error('useSlowTrackingQuery requires a SlowTrackingQueryCache');
  }

  const isSlow = useSyncExternalStore(
    (onStoreChange) => queryCache.subscribeSlow(peerQueryKey, onStoreChange),
    () => queryCache.isSlow(peerQueryKey),
  );

  const result = useQuery({
    ...options,
    placeholderData: isSlow ? undefined : keepPreviousData,
    meta: {
      ...options.meta,
      slowTracking,
    },
  });

  // Avoid spreading `result` to prevent react-query from observing all properties in `result`
  (result as Partial<UseSlowTrackingQueryResult<TData, TError>>).isSlow =
    isSlow;

  return result as UseSlowTrackingQueryResult<TData, TError>;
};

const useHasChanged = <T>(value: T) => {
  const [initialValue] = useState(value);
  return value !== initialValue;
};
