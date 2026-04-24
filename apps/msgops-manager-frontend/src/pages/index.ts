import type { PageRouteRecordRaw } from './pages.types';
import NotFoundPage from './NotFoundPage';
import { homePageRouter } from './HomePage';
import { userRoutes } from './Users';
import { accountsRoutes } from './Accounts';
import { billingRoutes } from './Billing';
import { setupRoute } from './SetupPage';
import { loginRoute } from './Login';

export type RouterName =
  | 'login'
  | 'homePage'
  | 'notFoundPage'
  | 'setupPage'
  | 'userCreatePage'
  | 'userEditPage'
  | 'usersPage'
  | 'accountCreatePage'
  | 'accountEditPage'
  | 'accountsPage'
  | 'billingPage';

export type RouterPath = Record<RouterName, string>;

export const routes: PageRouteRecordRaw[] = [
  loginRoute,
  { ...homePageRouter },
  { ...setupRoute },
  ...userRoutes,
  ...accountsRoutes,
  ...billingRoutes,
  { component: NotFoundPage, name: 'notFoundPage', path: '/:catchAll(.*)' },
];

export const routerPaths = routes.reduce<Record<RouterName, string>>(
  (routerPathsAcc, currentRouterPath) => ({
    ...routerPathsAcc,
    [currentRouterPath.name as string]: currentRouterPath.path,
  }),
  {} as Record<RouterName, string>,
);
