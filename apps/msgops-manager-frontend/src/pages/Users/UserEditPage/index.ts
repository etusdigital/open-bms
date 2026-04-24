import { authGuard } from '../../../router/guards';
import type { PageRouteRecordRaw } from '../../pages.types';
import UserEditPage from './UserEditPage.vue';

export const userEditPageRouter: PageRouteRecordRaw = {
  component: UserEditPage,
  name: 'userEditPage',
  path: '/users/edit/:id',
  beforeEnter: authGuard,
  hideFromRoles: ['billing'],
};

export default UserEditPage;
