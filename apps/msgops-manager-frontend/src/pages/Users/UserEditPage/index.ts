import { authGuard } from '@auth0/auth0-vue';
import type { PageRouteRecordRaw } from '../../pages.types';
import UserEditPage from './UserEditPage.vue';

export const userEditPageRouter: PageRouteRecordRaw = {
  component: UserEditPage,
  name: 'userEditPage',
  path: '/users/edit/:id',
  beforeEnter: authGuard,
  hideFromRoles: ['etus_superbilling'],
};

export default UserEditPage;
