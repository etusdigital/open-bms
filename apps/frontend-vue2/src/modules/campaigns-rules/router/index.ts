import { authGuard } from '@/auth/guards/auth.guard';
import CampaignsRulesModule from '@/modules/campaigns-rules/CampaignsRulesModule.vue';
import CampaignsEditor from '@/modules/campaigns/campaigns-editor-view.vue';
import CampaignsConfigs from '@/modules/campaigns-rules/views/CampaignsConfigs.vue';
import CampaignsRules from '@/modules/campaigns-rules/views/CampaignsRules.vue';
import CampaignsRulesEditor from '@/modules/campaigns-rules/views/CampaignsRulesEditor.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '',
    component: CampaignsRulesModule,
    beforeEnter: authGuard,
    children: [
      {
        path: 'campaign-rules',
        name: 'campaigns-rules',
        component: CampaignsRules,
      },
      {
        path: 'campaign-rules-new',
        name: 'campaign-rule-create',
        component: CampaignsRulesEditor,
        props: true,
      },
      {
        path: 'campaign-rules/:id',
        name: 'campaign-rule-edit',
        component: CampaignsRulesEditor,
        props: (route) => {
          return { ...route.params, ...{ id: parseInt(route.params.id, 10) } };
        },
      },
      {
        path: 'campaign-rules-configs',
        name: 'campaign-rules-configs',
        component: CampaignsConfigs,
      },
      {
        path: 'campaign-rules-configs-new',
        name: 'campaign-config-create',
        component: CampaignsEditor,
        props: true,
      },
      {
        path: 'campaign-rules-configs/:id',
        name: 'campaign-config-edit',
        component: CampaignsEditor,
        props: (route) => {
          return { ...route.params, ...{ id: parseInt(route.params.id, 10) } };
        },
      },
    ],
  },
];

export default router;
