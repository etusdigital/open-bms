import { authGuard } from '@/auth/guards/auth.guard';
import DashboardModule from '@/modules/dashboard/DashboardModule.vue';
import Dashboard from '@/modules/dashboard/views/Dashboard.vue';
import Leads from '@/modules/dashboard/views/Leads.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import StatisticsComparison from '../views/StatisticsComparison.vue';
import Insights from '../views/Insights.vue';
Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardModule,
    beforeEnter: authGuard,
    redirect: { name: 'statistics-route', params: { type: 'email' } },
    children: [
      {
        path: '/messages/:type/statistics',
        name: 'statistics-route',
        component: Dashboard,
      },
    ],
  },
  {
    path: '/',
    name: 'comparison',
    component: DashboardModule,
    beforeEnter: authGuard,
    redirect: { name: 'comparison-route', params: { type: 'email' } },
    children: [
      {
        path: '/messages/:type/comparison',
        name: 'comparison-route',
        component: StatisticsComparison,
      },
    ],
  },
  {
    path: '/leads',
    name: 'leads',
    component: DashboardModule,
    beforeEnter: authGuard,
    redirect: { name: 'leads-route' },
    children: [
      {
        path: '',
        name: 'leads-route',
        component: Leads,
      },
    ],
  },
  {
    path: '/insights',
    name: 'insights',
    component: DashboardModule,
    beforeEnter: authGuard,
    redirect: { name: 'insights-route' },
    children: [
      {
        path: '',
        name: 'insights-route',
        component: Insights,
      },
    ],
  },
];

export default router;
