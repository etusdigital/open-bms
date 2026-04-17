import { authGuard } from '@/auth/guards/auth.guard';
import SegmentModule from '@/modules/segment/SegmentModule.vue';
import SegmentCreate from '@/modules/segment/views/SegmentCreate.vue';
import Segments from '@/modules/segment/views/Segments.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/segments',
    name: 'segment',
    component: SegmentModule,
    redirect: { name: 'list-segments' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-segments',
        component: Segments,
      },
      {
        path: 'new',
        name: 'create-segments',
        component: SegmentCreate,
      },
      {
        path: ':segment_id?',
        name: 'edit-segments',
        component: SegmentCreate,
      },
    ],
  },
];

export default router;
