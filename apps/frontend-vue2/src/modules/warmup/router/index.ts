import { authGuard } from '@/auth/guards/auth.guard';
import WarmupModule from '@/modules/warmup/WarmupModule.vue';
import WarmupCreateEdit from '@/modules/warmup/views/WarmupCreateEdit.vue';
import WarmupList from '@/modules/warmup/views/WarmupList.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import WarmupStats from '../views/WarmupStats.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/warmups',
    name: 'warmups',
    component: WarmupModule,
    beforeEnter: authGuard,
    redirect: { name: 'warmup-list' },
    children: [
      {
        path: '',
        name: 'warmup-list',
        component: WarmupList,
      },
      {
        path: 'new',
        name: 'warmup-create',
        component: WarmupCreateEdit,
      },
      {
        path: ':warmup_id?',
        name: 'warmup-stats',
        component: WarmupStats,
      },
    ],
  },
];

export default router;
