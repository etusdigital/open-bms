import { authGuard } from '@auth0/auth0-vue';
import type { PageRouteRecordRaw } from '../../pages.types';
import AccountCreatePage from './AccountCreatePage.vue';

export const accountCreatePageRouter: PageRouteRecordRaw = {
  component: AccountCreatePage,
  name: 'accountCreatePage',
  path: '/accounts/create',
  beforeEnter: authGuard,
  hideFromRoles: ['etus_superbilling'],
};

export default AccountCreatePage;
