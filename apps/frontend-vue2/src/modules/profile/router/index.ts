import { authGuard } from '@/auth/guards/auth.guard';
import ProfileModule from '@/modules/profile/ProfileModule.vue';
import Profile from '@/modules/profile/views/Profile.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/profile',
    component: ProfileModule,
    redirect: { name: 'profile' },
    beforeEnter: authGuard,
    children: [
      {
        path: '/',
        name: 'profile',
        component: Profile,
      },
    ],
  },
];

export default router;
