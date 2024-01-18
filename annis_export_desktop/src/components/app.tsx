import { ErrorAlert } from '@/components/error-alert';
import { ErrorBoundary } from '@/components/error-boundary';
import { Page } from '@/components/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export const App: FC = () => (
  <ErrorBoundary fallback={(err) => <ErrorAlert message={err.message} />}>
    <QueryClientProvider client={queryClient}>
      <Page />
    </QueryClientProvider>
  </ErrorBoundary>
);
