import { authGuard } from '@/auth/guards/auth.guard';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import CampaignsModule from './campaigns-module.vue';
import CampaignsView from './campaigns-view.vue';
import CampaignsEditor from './campaigns-editor-view.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/campaigns',
    component: CampaignsModule,
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'news-campaigns',
        component: CampaignsView,
      },
      {
        path: 'new',
        name: 'news-campaigns-create',
        component: CampaignsEditor,
        props: true,
      },
      {
        path: ':id',
        name: 'news-campaigns-edit',
        component: CampaignsEditor,
        props: (route) => {
          return { ...route.params, ...{ id: parseInt(route.params.id, 10) } };
        },
      },
    ],
  },
];

export default router;
