import { ClientStateContextProvider } from '@/components/client-state-context-provider';
import { ErrorAlert } from '@/components/error-alert';
import { ErrorBoundary } from '@/components/error-boundary';
import { Page } from '@/components/page';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

export const App: FC = () => (
  <ErrorBoundary fallback={(err) => <ErrorAlert message={err.message} />}>
    <QueryClientProvider client={queryClient}>
      <ClientStateContextProvider>
        <TooltipProvider>
          <Page />
          <Toaster />
        </TooltipProvider>
      </ClientStateContextProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
