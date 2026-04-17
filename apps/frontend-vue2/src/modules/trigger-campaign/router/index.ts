import { authGuard } from '@/auth/guards/auth.guard';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import TriggerCampaignModule from '@/modules/trigger-campaign/TriggerCampaignModule.vue';
import TriggerCampaignList from '@/modules/trigger-campaign/TriggerCampaignList.vue';
import TriggerCampaignCreate from '@/modules/trigger-campaign/TriggerCampaignCreate.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/trigger-campaign',
    component: TriggerCampaignModule,
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-trigger-campaign',
        component: TriggerCampaignList,
      },
      {
        path: 'new',
        name: 'new-trigger-campaign',
        component: TriggerCampaignCreate,
        props: true,
      },
      {
        path: ':id',
        name: 'edit-trigger-campaign',
        component: TriggerCampaignCreate,
        props: (route) => {
          return { ...route.params, ...{ id: parseInt(route.params.id, 10) } };
        },
      },
    ],
  },
];

export default router;
