import { useEffect, type ComponentProps } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { RouterProvider } from '@tanstack/react-router';
import { __setAuth0Bridge } from '@/features/auth/use-auth';

type RouterPropsRouter = ComponentProps<typeof RouterProvider>['router'];

/**
 * Bridge component used in `auth0` mode.
 * - Mirrors Auth0 SDK handlers + reactive state into the local `useAuth`
 *   shim in a single atomic call so api-client, logout buttons, and
 *   useAuth() consumers see consistent state.
 * - Feeds the same state into the TanStack Router context.
 */
export function Auth0RouterBridge({ router }: { router: RouterPropsRouter }) {
  const auth = useAuth0();

  useEffect(() => {
    const sdkUser = auth.user;
    __setAuth0Bridge({
      fetcher: auth.getAccessTokenSilently,
      loginWithRedirect: (opts) => {
        auth.loginWithRedirect(opts);
      },
      logout: () => {
        auth.logout({ logoutParams: { returnTo: window.location.origin + '/login' } });
      },
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      user: sdkUser
        ? {
            // No `id` here — Auth0 SDK doesn't expose the local DB row id.
            // Type is `id?: number` so consumers must handle the gap until
            // useAuthInit hydrates the store from /users/me.
            email: sdkUser.email ?? '',
            name: sdkUser.name ?? sdkUser.email ?? '',
            picture: sdkUser.picture ?? null,
            providerId: sdkUser.sub ?? '',
          }
        : null,
    });
  }, [auth]);

  return (
    <RouterProvider
      router={router}
      context={{ auth: { isAuthenticated: auth.isAuthenticated, isLoading: auth.isLoading } }}
    />
  );
}
