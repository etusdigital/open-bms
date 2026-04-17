import { authGuard } from '@/auth/guards/auth.guard';
import TemplatesModule from '@/modules/templates/TemplatesModule.vue';
import TemplatesCreate from '@/modules/templates/views/TemplatesCreate.vue';
import Templates from '@/modules/templates/views/Templates.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/templates',
    name: 'templates',
    component: TemplatesModule,
    redirect: { name: 'list-templates' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-templates',
        component: Templates,
      },
      {
        path: 'new',
        name: 'create-templates',
        component: TemplatesCreate,
      },
      {
        path: ':template_id?',
        name: 'edit-template',
        component: TemplatesCreate,
      },
    ],
  },
];

export default router;
