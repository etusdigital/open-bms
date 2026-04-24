import { authGuard } from '../../../router/guards';
import { Globe } from '@vicons/ionicons5';
import { i18n } from '../../../i18n';
import type { PageRouteRecordRaw } from '../../pages.types';
import AccountsPage from './AccountsPage.vue';

export const accountsPageRouter: PageRouteRecordRaw = {
  component: AccountsPage,
  name: 'accountsPage',
  path: '/accounts',
  beforeEnter: authGuard,
  icon: Globe,
  label: i18n.global.t('accountPage.accounts'),
  hideFromRoles: ['billing'],
};

export default AccountsPage;
