import automationRoutes from '@/modules/automations/router';
import messagesRoutes from '@/modules/messages/router';
import templatesRoutes from '@/modules/templates/router';
import dashboardRoutes from '@/modules/dashboard/router';
import campaignsRoutes from '@/modules/campaigns/campaigns-router';
import campaignRulesRoutes from '@/modules/campaigns-rules/router';
import poolsRoutes from '@/modules/pools/router';
import contactsRouter from '@/modules/contacts/router';
import tagRoutes from '@/modules/tags/router';
import customEventsRoutes from '@/modules/custom-events/router';
import segmentRoutes from '@/modules/segment/router';
import customFieldsRoutes from '@/modules/customfields/router';
import profileRoutes from '@/modules/profile/router';
import settingsRoutes from '@/modules/settings/router';
import warmupRoutes from '@/modules/warmup/router';
import deniedRoutes from '@/components/access-denied/router/index';
import Vue from 'vue';
import Router from 'vue-router';
import { RouteConfig } from 'vue-router/types/router';
import store from './store';
import triggerCampaignRoutes from './modules/trigger-campaign/router';
import productRoutes from './modules/products/router';
import labelsRoutes from './modules/labels/router';

Vue.use(Router);

const baseRoutes: RouteConfig[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/login/LoginPage.vue'),
    meta: { public: true },
  },
];

const routes = baseRoutes.concat(
  automationRoutes,
  campaignsRoutes,
  contactsRouter,
  customFieldsRoutes,
  dashboardRoutes,
  messagesRoutes,
  poolsRoutes,
  profileRoutes,
  segmentRoutes,
  tagRoutes,
  templatesRoutes,
  warmupRoutes,
  settingsRoutes,
  deniedRoutes,
  customEventsRoutes,
  campaignRulesRoutes,
  triggerCampaignRoutes,
  productRoutes,
  labelsRoutes
);

const router = new Router({
  routes,
  mode: 'history',
});

const routePermissionByName: Record<string, string | string[]> = {
  'news-campaigns': 'campaigns:view',
  'news-campaigns-create': ['campaigns:create', 'campaigns:create_from_rule'],
  'news-campaigns-template-create': ['campaigns:create', 'campaigns:create_from_rule'],
  'news-campaigns-edit': 'campaigns:update',
  'list-trigger-campaign': 'campaigns:view',
  'new-trigger-campaign': ['campaigns:create', 'campaigns:create_from_rule'],
  'edit-trigger-campaign': 'campaigns:update',
  'product-list': 'campaigns:view',

  'automations/emails': 'automations:view',
  'automation/emails': 'automations:update',
  'automation/emails/new': 'automations:create',
  'automations/transactional': 'automations:view',

  'list-automations-message': 'messages:view',
  'list-web-push': 'messages:view',
  'list-mobile-push': 'messages:view',
  'list-sms': 'messages:view',
  'list-whatsapp': 'messages:view',
  'messages-create': 'messages:create',
  'messages-edit': 'messages:update',
  'automations_deliverability-test': 'messages:test_send',
  'automations_deliverability-test-result': 'messages:view',
  'message-2fa-create': 'messages:create',
  'messages-2fa-edit': 'messages:update',
  '2fa-create-new-group': 'messages:update',
  '2fa-settings-email': 'messages:view',
  '2fa-settings-sms': 'messages:view',
  '2fa-settings-whatsapp': 'messages:view',
  'list-2fa': 'messages:view',
  postmaster: 'infra:view',

  'statistics-route': 'analytics:dashboard_view',
  'comparison-route': 'analytics:comparison_view',
  'leads-route': 'analytics:insights_view',
  'insights-route': 'analytics:insights_view',

  'contacts-list': 'audience:contacts_view',
  'contacts-view': 'audience:contacts_view',
  'import-contacts': 'audience:contacts_import',
  'suppressed-contacts': 'audience:contacts_suppress',
  'list-segments': 'audience:segments_view',
  'create-segments': 'audience:segments_execute',
  'edit-segments': 'audience:segments_execute',
  'list-tags': 'audience:tags_view',
  'create-tags': 'audience:tags_manage',
  'edit-tags': 'audience:tags_manage',
  'list-customfields': 'audience:custom_fields_view',
  'create-customfields': 'audience:custom_fields_manage',
  'edit-customfields': 'audience:custom_fields_manage',

  'campaigns-rules': 'infra:manage',
  'campaign-rule-create': 'infra:manage',
  'campaign-rule-edit': 'infra:manage',
  'campaign-rules-configs': 'infra:manage',
  'campaign-config-create': 'infra:manage',
  'campaign-config-edit': 'infra:manage',
  'list-custom-events': 'infra:view',
  'create-custom-events': 'infra:manage',
  'edit-custom-events': 'infra:manage',
  'events-logs': 'infra:view',
  'list-pools': 'infra:view',
  'create-pools': 'infra:manage',
  'edit-pools': 'infra:manage',
  'warmup-list': 'infra:view',
  'warmup-create': 'infra:manage',
  'warmup-stats': 'infra:view',
  'list-labels': 'infra:view',
  'create-labels': 'infra:manage',
  'edit-labels': 'infra:manage',

  settings: 'account:settings_view',
};

// Routes that require currentAccount.isInternal === true
const internalOnlyRoutes = new Set([
  'warmup-list',
  'warmup-create',
  'warmup-stats',
  'list-pools',
  'create-pools',
  'edit-pools',
  'list-custom-events',
  'create-custom-events',
  'edit-custom-events',
  'events-logs',
  'campaigns-rules',
  'campaign-rule-create',
  'campaign-rule-edit',
  'campaign-rules-configs',
  'campaign-config-create',
  'campaign-config-edit',
  'list-labels',
  'create-labels',
  'edit-labels',
  'insights-route',
  'list-2fa',
  'message-2fa-create',
  'messages-2fa-edit',
  '2fa-create-new-group',
  '2fa-settings-email',
  '2fa-settings-sms',
  '2fa-settings-whatsapp',
]);

function waitForAuthReady(): Promise<void> {
  if (store.state.authReady) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const unwatch = store.watch(
      (state) => state.authReady,
      (ready) => {
        if (ready) {
          unwatch();
          resolve();
        }
      }
    );
    if (store.state.authReady) {
      unwatch();
      resolve();
    }
  });
}

router.beforeEach(async (to, from, next) => {
  const modal = document.querySelector('.dialog');
  const modalBg = document.querySelector('.v--modal-overlay');
  const modalBgClick = document.querySelector('.v--modal-background-click');

  if (modal) {
    modal.remove();
  }
  if (modalBg) {
    modalBg.remove();
  }
  if (modalBgClick) {
    modalBgClick.remove();
  }

  if (to.meta?.public) {
    return next();
  }

  await waitForAuthReady();

  const routeName = (to?.name || '') as string;

  // Block internal-only routes for external accounts
  if (internalOnlyRoutes.has(routeName)) {
    const currentAccount = store.state.currentAccount;
    if (!currentAccount?.isInternal) {
      return next('/access-denied');
    }
  }

  const requiredPermission = (to?.meta?.permission as string | undefined) || routePermissionByName[routeName];
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAccess = permissions.some((p) => store.getters.can(p));
    if (!hasAccess) {
      return next('/access-denied');
    }
  }

  next();
});

export default router;
