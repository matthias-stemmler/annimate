import { ErrorBoundary, RouteErrorBoundary } from '@/components/error-boundary';
import { MainPage } from '@/components/main-page/main-page';
import { ManagePage } from '@/components/manage-page/manage-page';
import { StoreProvider } from '@/components/store-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Window } from '@/components/window';
import { SlowTrackingQueryCache } from '@/lib/slow-queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FC } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

const queryClient = new QueryClient({
  queryCache: new SlowTrackingQueryCache(),
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

const router = createMemoryRouter([
  {
    path: '/',
    element: <Window />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: <MainPage />,
      },
      {
        path: '/manage',
        element: <ManagePage />,
      },
    ],
  },
]);

export const App: FC = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
