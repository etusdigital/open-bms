import { authGuard } from '../../../router/guards';
import type { PageRouteRecordRaw } from '../../pages.types';
import UserCreatePage from './UserCreatePage.vue';

export const userCreatePageRouter: PageRouteRecordRaw = {
  component: UserCreatePage,
  name: 'userCreatePage',
  path: '/users/create',
  beforeEnter: authGuard,
  hideFromRoles: ['billing'],
};

export default UserCreatePage;
