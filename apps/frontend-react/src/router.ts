import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: {
    auth: undefined!,
  },
});

// Type-safe router registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
