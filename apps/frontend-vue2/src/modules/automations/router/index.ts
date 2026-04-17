import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import { authGuard } from '@/auth/guards/auth.guard';
import Automation from '../views/Automation.vue';
import Automations from '../views/Automations.vue';
import Transactional from '../views/Transactional.vue';

import AutomationModule from '../AutomationModule.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/automations',
    beforeEnter: authGuard,
    component: AutomationModule,
    children: [
      {
        path: 'emails',
        name: 'automations/emails',
        component: Automations,
      },
      {
        path: 'emails/:automation_id',
        name: 'automation/emails',
        component: Automation,
        children: [],
      },
      {
        path: 'emails/new',
        name: 'automation/emails/new',
        component: Automation,
      },
      {
        path: 'transactional',
        name: 'automations/transactional',
        component: Transactional,
      },
    ],
  },
];

export default router;
