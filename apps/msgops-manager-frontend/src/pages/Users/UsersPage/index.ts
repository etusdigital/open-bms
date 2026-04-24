import { authGuard } from '../../../router/guards';
import type { PageRouteRecordRaw } from '../../pages.types';
import UsersPage from './UsersPage.vue';
import { Person } from '@vicons/ionicons5';
import { i18n } from '../../../i18n';

export const usersPageRouter: PageRouteRecordRaw = {
  component: UsersPage,
  name: 'usersPage',
  path: '/users',
  beforeEnter: authGuard,
  icon: Person,
  label: i18n.global.t('userPage.users'),
  hideFromRoles: ['billing'],
};

export default UsersPage;
