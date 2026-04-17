import Vue from 'vue';
import Router, { RouteConfig } from 'vue-router';
import Contacts from '@/modules/contacts/views/Contacts.vue';
import ContactsModule from '@/modules/contacts/ContactsModule.vue';
import { authGuard } from '@/auth/guards/auth.guard';
import ContactsInformations from '@/modules/contacts/views/ContactsInformations.vue';
import ContactsImport from '@/modules/contacts/views/ContactsImport.vue';
import Suppressions from '../views/Suppressions.vue';

Vue.use(Router);

const router: Array<RouteConfig> = [
  {
    path: '/contacts',
    name: 'contacts',
    component: ContactsModule,
    redirect: { name: 'contacts-list' },
    beforeEnter: authGuard,
    children: [
      {
        path: '',
        name: 'contacts-list',
        component: Contacts,
      },
      {
        path: 'new',
        name: 'import-contacts',
        component: ContactsImport,
      },
      {
        path: 'suppressions/:type',
        name: 'suppressed-contacts',
        component: Suppressions,
      },
      {
        path: ':contact_id?',
        name: 'contacts-view',
        component: ContactsInformations,
      },
    ],
  },
];

export default router;
