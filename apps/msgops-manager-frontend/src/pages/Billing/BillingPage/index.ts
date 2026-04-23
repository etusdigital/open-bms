import { authGuard } from '../../../router/guards';
import { Receipt } from '@vicons/ionicons5';
import { i18n } from '../../../i18n';
import type { PageRouteRecordRaw } from '../../pages.types';
import BillingPage from './BillingPage.vue';

export const billingPageRouter: PageRouteRecordRaw = {
    component: BillingPage,
    name: 'billingPage',
    path: '/billing',
    beforeEnter: authGuard,
    icon: Receipt,
    label: i18n.global.t('billingPage.billing'),
};

export default BillingPage;
