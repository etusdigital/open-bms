import { authGuard } from '@/auth/guards/auth.guard';
import ProductModule from '../ProductModule.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import Product from '../views/Product.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/',
    name: 'product',
    component: ProductModule,
    redirect: { name: 'product-list' },
    beforeEnter: authGuard,
    children: [
      {
        path: 'product',
        name: 'product-list',
        component: Product,
      },
    ],
  },
];

export default router;
