import type { PageRouteRecordRaw } from '../pages.types';
import SetupPage from './SetupPage.vue';

export const setupRoute: PageRouteRecordRaw = {
  component: SetupPage,
  name: 'setupPage',
  path: '/setup',
};

export default SetupPage;
