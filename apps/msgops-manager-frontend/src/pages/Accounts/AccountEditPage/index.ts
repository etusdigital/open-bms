import { authGuard } from '../../../router/guards';
import type { PageRouteRecordRaw } from '../../pages.types';
import AccountEditPage from './AccountEditPage.vue';

export const accountEditPageRouter: PageRouteRecordRaw = {
  component: AccountEditPage,
  name: 'accountEditPage',
  path: '/accounts/edit/:id',
  beforeEnter: authGuard,
  hideFromRoles: ['billing'],
};

export default accountEditPageRouter;
