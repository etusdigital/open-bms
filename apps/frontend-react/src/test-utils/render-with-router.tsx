import { render, act, type RenderOptions } from '@testing-library/react';
import { createRouter, createRootRoute, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
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

  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>,
      renderOptions,
    );
  });

  return result;
}
