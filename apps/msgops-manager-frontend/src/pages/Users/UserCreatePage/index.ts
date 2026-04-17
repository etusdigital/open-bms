import { authGuard } from '@auth0/auth0-vue';
import type { PageRouteRecordRaw } from '../../pages.types';
import UserCreatePage from './UserCreatePage.vue';

export const userCreatePageRouter: PageRouteRecordRaw = {
  component: UserCreatePage,
  name: 'userCreatePage',
  path: '/users/create',
  beforeEnter: authGuard,
  hideFromRoles: ['etus_superbilling'],
};

export default UserCreatePage;
