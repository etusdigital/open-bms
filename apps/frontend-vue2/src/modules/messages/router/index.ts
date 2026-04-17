import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import { authGuard } from '@/auth/guards/auth.guard';

import DeliverabilityTest from '../views/DeliverabilityTest.vue';
import ResultGlockApps from '../views/ResultGlockApps.vue';
import EmailPostMaster from '../views/EmailPostMaster.vue';
import Messages from '../views/Messages.vue';
import MessageModule from '../MessageModule.vue';
import MessageCreate from '../views/MessageCreate.vue';
import TwoFAMessages from '../views/2FAMessages.vue';
import TwoFASettings from '../views/2FASettings.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/messages',
    beforeEnter: authGuard,
    component: MessageModule,
    redirect: 'messages/email?type=email',
    children: [
      {
        path: 'email/:message_id/deliverability-test',
        name: 'automations_deliverability-test',
        component: DeliverabilityTest,
      },
      {
        path: 'email/:message_id/deliverability-test-result',
        name: 'automations_deliverability-test-result',
        component: ResultGlockApps,
      },
      {
        path: '2FA/:type/new',
        name: 'message-2fa-create',
        component: MessageCreate,
      },
      {
        path: '2FA/:type/:message_id(\\d+)',
        name: 'messages-2fa-edit',
        component: MessageCreate,
      },
      {
        path: '2FA/:type/new-group',
        name: '2fa-create-new-group',
        component: TwoFASettings,
      },
      {
        path: '2FA/email/:group',
        name: '2fa-settings-email',
        component: TwoFASettings,
      },
      {
        path: '2FA/sms/:group',
        name: '2fa-settings-sms',
        component: TwoFASettings,
      },
      {
        path: '2FA/whatsapp/:group',
        name: '2fa-settings-whatsapp',
        component: TwoFASettings,
      },
      {
        path: '2FA/:type',
        name: 'list-2fa',
        component: TwoFAMessages,
      },
      {
        path: ':type/new',
        name: 'messages-create',
        component: MessageCreate,
      },
      {
        path: ':type/:message_id',
        name: 'messages-edit',
        component: MessageCreate,
      },
      {
        path: 'postmaster',
        name: 'postmaster',
        component: EmailPostMaster,
      },
      {
        path: 'email',
        name: 'list-automations-message',
        component: Messages,
      },
      {
        path: 'web-push',
        name: 'list-web-push',
        component: Messages,
      },
      {
        path: 'mobile-push',
        name: 'list-mobile-push',
        component: Messages,
      },
      {
        path: 'sms',
        name: 'list-sms',
        component: Messages,
      },
      {
        path: 'whatsapp',
        name: 'list-whatsapp',
        component: Messages,
      },
    ],
  },
];

export default router;
