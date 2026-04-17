import { authGuard } from '@/auth/guards/auth.guard';
import CustomEventModule from '@/modules/custom-events/CustomEventModule.vue';
import CustomEventEdit from '@/modules/custom-events/views/CustomEventEdit.vue';
import CustomEvents from '@/modules/custom-events/views/CustomEvents.vue';
import CustomEventsLogs from '@/modules/custom-events/views/CustomEventsLogs.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/custom-events',
    name: 'custom-events',
    component: CustomEventModule,
    redirect: { name: 'list-custom-events' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-custom-events',
        component: CustomEvents,
      },
      {
        path: 'new',
        name: 'create-custom-events',
        component: CustomEventEdit,
      },
      {
        path: ':custom_event_id',
        name: 'edit-custom-events',
        component: CustomEventEdit,
      },
      {
        path: ':custom_event_id/logs',
        name: 'events-logs',
        component: CustomEventsLogs,
      },
    ],
  },
];

export default router;
