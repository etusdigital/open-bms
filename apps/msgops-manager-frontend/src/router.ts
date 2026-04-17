import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router';
import { routes } from './pages';
import { useUserStore } from './stores';
import { auth0 } from './infra/Auth';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to: RouteLocationNormalized) => {
  if (to.path === '/callback' || to.path === '/login') {
    return true;
  }
  await auth0.checkSession();

  const userStore = useUserStore();
  if (auth0.user?.value && !userStore.roles.length) {
    userStore.setRoles(auth0.user.value['https://bri.us/roles'] || []);
  }

  if (userStore.roles.includes('etus_superbilling')) {
    if (to.path === '/users' || to.path === '/accounts') {
      return '/billing';
    }
  }

  return true;
});

export default router;
