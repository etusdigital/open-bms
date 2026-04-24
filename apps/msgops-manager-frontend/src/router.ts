import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router';
import { routes } from './pages';
import { useUserStore } from './stores';
import { userHttpGateway } from './gateways/User';
import { bootstrapAuth, useAuth } from './composables/useAuth';
import { setupGateway } from './gateways/Setup';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

let setupChecked = false;

router.beforeEach(async (to: RouteLocationNormalized) => {
  if ((to.meta as any)?.public || to.path === '/login') {
    return true;
  }

  if (!setupChecked) {
    try {
      const status = await setupGateway.getStatus();
      setupChecked = true;
      if (!status.configured) {
        return '/setup';
      }
    } catch (err: any) {
      // Only redirect to /setup when the API says the wizard hasn't run yet (404 or network
      // failure on a fresh VM). For 5xx we assume the platform is already configured and
      // the API is transiently unhealthy — better to surface an auth error than to flash
      // the wizard at every user on a hiccup.
      const status = err?.response?.status;
      if (!status || status === 404) {
        return '/setup';
      }
      // setupChecked stays false so we retry on the next navigation.
    }
  }

  const { isAuthenticated, refresh } = useAuth();
  if (!isAuthenticated.value) {
    await bootstrapAuth();
  }
  if (!isAuthenticated.value) {
    const token = await refresh();
    if (!token) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }

  const userStore = useUserStore();
  if (!userStore.effectiveRole) {
    try {
      const me: any = await userHttpGateway.getMe();
      userStore.setAuthContext(me);
    } catch {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }

  // msgops-manager-frontend is the super-admin console (tenant & global user management).
  // Non-super-admins belong in the operations app (frontend-vue2). Redirect them there.
  if (!userStore.isSuperAdmin) {
    const opsUrl = import.meta.env.VITE_APP_REDIRECT_MSGOPS;
    if (opsUrl && typeof window !== 'undefined') {
      window.location.replace(opsUrl);
      return false;
    }
    // Fallback when ops URL isn't configured — send to /login with a flag.
    return { name: 'login', query: { forbidden: '1' } };
  }

  if (userStore.effectiveRole === 'billing' && !userStore.isSuperAdmin) {
    if (to.path === '/users' || to.path === '/accounts') {
      return '/billing';
    }
  }

  return true;
});

export default router;
