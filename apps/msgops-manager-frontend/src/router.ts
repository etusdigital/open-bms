import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router';
import { routes } from './pages';
import { useUserStore } from './stores';
import { auth0 } from './infra/Auth';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const ROLES_CLAIM = import.meta.env.VITE_AUTH0_ROLES_CLAIM || 'https://bms.local/roles';
const BILLING_ONLY_ROLE = import.meta.env.VITE_AUTH0_BILLING_ONLY_ROLE || 'superbilling';

router.beforeEach(async (to: RouteLocationNormalized) => {
  if (to.path === '/callback' || to.path === '/login') {
    return true;
  }
  await auth0.checkSession();

  const userStore = useUserStore();
  if (auth0.user?.value && !userStore.roles.length) {
    userStore.setRoles(auth0.user.value[ROLES_CLAIM] || []);
  }

  if (userStore.roles.includes(BILLING_ONLY_ROLE)) {
    if (to.path === '/users' || to.path === '/accounts') {
      return '/billing';
    }
  }

  return true;
});

export default router;
