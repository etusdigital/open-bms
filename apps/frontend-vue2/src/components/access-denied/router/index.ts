import AccessDenied from '../AccessDenied.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/access-denied',
    name: 'access-denied',
    component: AccessDenied,
  },
];

export default router;
