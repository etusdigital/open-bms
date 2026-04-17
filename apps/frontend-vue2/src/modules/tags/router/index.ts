import { authGuard } from '@/auth/guards/auth.guard';
import TagsModule from '@/modules/tags/TagsModule.vue';
import TagCreateEdit from '@/modules/tags/views/TagCreateEdit.vue';
import Tags from '@/modules/tags/views/Tags.vue';
import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/tags',
    name: 'tags',
    component: TagsModule,
    redirect: { name: 'list-tags' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'list-tags',
        component: Tags,
      },
      {
        path: 'new',
        name: 'create-tags',
        component: TagCreateEdit,
      },
      {
        path: ':account_id?',
        name: 'edit-tags',
        component: TagCreateEdit,
      },
    ],
  },
];

export default router;
