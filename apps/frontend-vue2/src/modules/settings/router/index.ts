import { authGuard } from '@/auth/guards/auth.guard';
import SettingsModule from '@/modules/settings/SettingsModule.vue';
import Settings from '@/modules/settings/views/Settings.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/settings',
    component: SettingsModule,
    redirect: { name: 'settings' },
    beforeEnter: authGuard,
    children: [
      {
        path: '/',
        name: 'settings',
        component: Settings,
      },
    ],
  },
];

export default router;
