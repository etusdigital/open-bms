import { authGuard } from '@/auth/guards/auth.guard';
import CustomFieldsModule from '@/modules/customfields/CustomFieldsModule.vue';
import CustomFieldsCreateEdit from '@/modules/customfields/views/CustomFieldsCreateEdit.vue';
import CustomFields from '@/modules/customfields/views/CustomFields.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/customfields',
    name: 'customfields',
    component: CustomFieldsModule,
    redirect: { name: 'list-customfields' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-customfields',
        component: CustomFields,
      },
      {
        path: 'new',
        name: 'create-customfields',
        component: CustomFieldsCreateEdit,
      },
      {
        path: ':account_id?',
        name: 'edit-customfields',
        component: CustomFieldsCreateEdit,
      },
    ],
  },
];

export default router;
