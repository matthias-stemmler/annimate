import {
  SlowTrackingQueryCache,
  SlowTrackingState,
  useSlowTrackingQuery,
} from '@/lib/slow-queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('slow-queries', () => {
  type TestProps = {
    queryClient: QueryClient;
    param: string;
    instances: { testId: string; queryKeyPrefix: string; duration: number }[];
  };

  const Test: FC<TestProps> = ({ queryClient, param, instances }) => (
    <QueryClientProvider client={queryClient}>
      {instances.map((instance) => (
        <TestQuery
          key={instance.testId}
          testId={instance.testId}
          param={param}
          queryKeyPrefix={instance.queryKeyPrefix}
          duration={instance.duration}
        />
      ))}
    </QueryClientProvider>
  );

  type TestQueryProps = {
    testId: string;
    param: string;
    queryKeyPrefix: string;
    duration: number;
  };

  const TestQuery: FC<TestQueryProps> = ({
    testId,
    param,
    queryKeyPrefix,
    duration,
  }) => {
    const { data, isPending, isSlow } = useSlowTrackingQuery({
      queryKey: [queryKeyPrefix, param],
      queryFn: async () => {
        await new Promise((r) => setTimeout(r, duration));
        return param;
      },
      slowTracking: {
        peerQueryKey: [queryKeyPrefix],
        timeout: 500,
      },
    });

    return (
      <div data-testid={testId}>
        {JSON.stringify({ data, isPending, isSlow })}
      </div>
    );
  };

  const expectOutput = (
    instances: { testId: string; expected: Record<string, unknown> }[],
  ) => {
    for (const instance of instances) {
      const outputValue = screen.getByTestId(instance.testId).textContent;
      const output = outputValue === null ? undefined : JSON.parse(outputValue);
      expect(output).toEqual(instance.expected);
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should track "slow" state of queries', async () => {
    const queryCache = new SlowTrackingQueryCacheWithDiagnostics();
    const queryClient = new QueryClient({
      queryCache,
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { rerender, unmount } = render(
      <Test
        queryClient={queryClient}
        param="A"
        instances={[
          // Two queries with the same key, one "unrelated" query that takes way longer
          { testId: 'output1', queryKeyPrefix: 'test1', duration: 1500 },
          { testId: 'output2', queryKeyPrefix: 'test1', duration: 1500 },
          { testId: 'output3', queryKeyPrefix: 'test2', duration: 10000 },
        ]}
      />,
    );

    // Expect 2 keys, 3 observers
    expect(queryCache.getStateKeyCount()).toBe(2);
    expect(queryCache.getListenersKeyCount()).toBe(2);
    expect(queryCache.getObserverCount()).toBe(3);

    // Initially pending, then 'A' after 1500ms
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: false, data: undefined },
      },
      {
        testId: 'output2',
        expected: { isPending: true, isSlow: false, data: undefined },
      },
    ]);

    await advanceTimers(1499);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
      {
        testId: 'output2',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
    ]);

    await advanceTimers(1);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
      {
        testId: 'output2',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
    ]);

    // Change 'A' to 'B'
    rerender(
      <Test
        queryClient={queryClient}
        param="B"
        instances={[
          { testId: 'output1', queryKeyPrefix: 'test1', duration: 1500 },
          { testId: 'output2', queryKeyPrefix: 'test1', duration: 1500 },
          { testId: 'output3', queryKeyPrefix: 'test2', duration: 10000 },
        ]}
      />,
    );

    // Still expect 2 keys, 3 observers
    expect(queryCache.getStateKeyCount()).toBe(2);
    expect(queryCache.getListenersKeyCount()).toBe(2);
    expect(queryCache.getObserverCount()).toBe(3);

    // First still 'A', then pending after 500ms, then 'B' after another 1000ms
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
      {
        testId: 'output2',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
    ]);

    await advanceTimers(499);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
      {
        testId: 'output2',
        expected: { isPending: false, isSlow: false, data: 'A' },
      },
    ]);

    await advanceTimers(1);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
      {
        testId: 'output2',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
    ]);

    await advanceTimers(999);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
      {
        testId: 'output2',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
    ]);

    await advanceTimers(1);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'B' },
      },
      {
        testId: 'output2',
        expected: { isPending: false, isSlow: false, data: 'B' },
      },
    ]);

    // Change 'B' to 'C', remove one observer
    rerender(
      <Test
        queryClient={queryClient}
        param="C"
        instances={[
          { testId: 'output1', queryKeyPrefix: 'test1', duration: 1500 },
          { testId: 'output3', queryKeyPrefix: 'test2', duration: 10000 },
        ]}
      />,
    );

    // Still expect 2 keys, but only 2 observers
    expect(queryCache.getStateKeyCount()).toBe(2);
    expect(queryCache.getObserverCount()).toBe(2);
    expect(queryCache.getListenersKeyCount()).toBe(2);

    // First still 'B', then pending after 500ms, then 'C' after another 1000ms
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'B' },
      },
    ]);

    await advanceTimers(499);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'B' },
      },
    ]);

    await advanceTimers(1);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
    ]);

    await advanceTimers(999);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: true, isSlow: true, data: undefined },
      },
    ]);

    await advanceTimers(1);
    expectOutput([
      {
        testId: 'output1',
        expected: { isPending: false, isSlow: false, data: 'C' },
      },
    ]);

    unmount();

    // Expect no keys and no observers
    expect(queryCache.getStateKeyCount()).toBe(0);
    expect(queryCache.getObserverCount()).toBe(0);
    expect(queryCache.getListenersKeyCount()).toBe(0);
  });
});

class SlowTrackingQueryCacheWithDiagnostics extends SlowTrackingQueryCache {
  getStateKeyCount() {
    return this.slowTrackingStateByHash.size;
  }

  getObserverCount() {
    return Array.from(this.slowTrackingStateByHash.values()).reduce(
      (acc: number, state: SlowTrackingState) => acc + state.observerCount,
      0,
    );
  }

  getListenersKeyCount() {
    return this.slowListenersByHash.size;
  }
}

const advanceTimers = async (ms: number) => {
  let remainingMs = ms;
  while (remainingMs > 0) {
    const advanceByMs = Math.min(remainingMs, 100);
    await act(async () => {
      vi.advanceTimersByTime(advanceByMs);
    });
    remainingMs -= advanceByMs;
  }
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
};
