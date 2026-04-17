import { authGuard } from '@/auth/guards/auth.guard';
import PoolsModule from '@/modules/pools/PoolsModule.vue';
import PoolsCreate from '@/modules/pools/views/PoolsCreate.vue';
import Pools from '@/modules/pools/views/Pools.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/pools',
    name: 'pools',
    component: PoolsModule,
    redirect: { name: 'list-templates' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-pools',
        component: Pools,
      },
      {
        path: 'new',
        name: 'create-pools',
        component: PoolsCreate,
      },
      {
        path: ':pool_id?',
        name: 'edit-pools',
        component: PoolsCreate,
      },
    ],
  },
];

export default router;
