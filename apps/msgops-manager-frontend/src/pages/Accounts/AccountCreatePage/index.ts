import { authGuard } from '../../../router/guards';
import type { PageRouteRecordRaw } from '../../pages.types';
import AccountCreatePage from './AccountCreatePage.vue';

export const accountCreatePageRouter: PageRouteRecordRaw = {
  component: AccountCreatePage,
  name: 'accountCreatePage',
  path: '/accounts/create',
  beforeEnter: authGuard,
  hideFromRoles: ['billing'],
};

export default AccountCreatePage;
