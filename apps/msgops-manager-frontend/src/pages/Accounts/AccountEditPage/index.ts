import { authGuard } from '@auth0/auth0-vue';
import type { PageRouteRecordRaw } from '../../pages.types';
import AccountEditPage from './AccountEditPage.vue';

export const accountEditPageRouter: PageRouteRecordRaw = {
  component: AccountEditPage,
  name: 'accountEditPage',
  path: '/accounts/edit/:id',
  beforeEnter: authGuard,
  hideFromRoles: ['etus_superbilling'],
};

export default accountEditPageRouter;
