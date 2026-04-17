import { authGuard } from '@/auth/guards/auth.guard';
import LabelsModule from '@/modules/labels/LabelsModule.vue';
import LabelCreateEdit from '@/modules/labels/views/LabelCreateEdit.vue';
import Labels from '@/modules/labels/views/Labels.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/labels',
    name: 'labels',
    component: LabelsModule,
    redirect: { name: 'list-labels' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-labels',
        component: Labels,
      },
      {
        path: 'new',
        name: 'create-labels',
        component: LabelCreateEdit,
      },
      {
        path: ':label_id?',
        name: 'edit-labels',
        component: LabelCreateEdit,
      },
    ],
  },
];

export default router;
