import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router';
import { watch } from 'vue';
import { routes } from './pages';
import { useUserStore } from './stores';
import { auth0 } from './infra/Auth';
import { setupGateway } from './gateways/Setup';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const ROLES_CLAIM = import.meta.env.VITE_AUTH0_ROLES_CLAIM || 'https://bms.local/roles';
const BILLING_ONLY_ROLE = import.meta.env.VITE_AUTH0_BILLING_ONLY_ROLE || 'superbilling';

let setupChecked = false;

function waitForAuth0(): Promise<void> {
  if (!auth0.isLoading.value) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const stop = watch(auth0.isLoading, (loading) => {
      if (!loading) { stop(); resolve(); }
    });
  });
}

router.beforeEach(async (to: RouteLocationNormalized) => {
  if (to.path === '/callback' || to.path === '/login' || to.path.startsWith('/setup')) {
    return true;
  }

  if (!setupChecked) {
    try {
      const status = await setupGateway.getStatus();
      setupChecked = true;
      if (!status.configured) {
        return '/setup';
      }
    } catch {
      // API unreachable — redirect to setup rather than forcing auth
      return '/setup';
    }
  }

  // Wait for Auth0 to finish its initial session check
  await waitForAuth0();

  if (!auth0.isAuthenticated.value) {
    await auth0.loginWithRedirect({ appState: { target: to.fullPath } });
    return false;
  }

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
