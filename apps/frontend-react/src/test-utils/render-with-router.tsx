import { render, act, type RenderOptions } from '@testing-library/react';
import { createRouter, createRootRoute, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactElement } from 'react';

interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string;
}

export async function renderWithRouter(
  ui: ReactElement,
  { initialPath = '/', ...renderOptions }: RenderWithRouterOptions = {},
) {
  const rootRoute = createRootRoute({
    component: () => ui,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  await router.load();

  // Components that use react-query hooks (directly or via importOriginal mocks)
  // need a client in the tree. Disable retries so failures surface immediately.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
      renderOptions,
    );
  });

  return result;
}
