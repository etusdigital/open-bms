import type { PageRouteRecordRaw } from '../pages.types';
import SetupPage from './SetupPage.vue';

export const setupRoute: PageRouteRecordRaw = {
  component: SetupPage,
  name: 'setupPage',
  path: '/setup',
  meta: { public: true } as any,
};

export default SetupPage;
