import type { PageRouteRecordRaw } from '../pages.types';
import LoginPage from './LoginPage.vue';

export const loginRoute: PageRouteRecordRaw = {
  component: LoginPage,
  name: 'login',
  path: '/login',
  meta: { public: true } as any,
};

export { LoginPage };
