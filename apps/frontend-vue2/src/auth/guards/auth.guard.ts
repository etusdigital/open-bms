import { NavigationGuardNext, Route } from 'vue-router/types/router';
import { isAuthenticated, refresh } from '@/services/auth.service';

async function authGuard(to: Route, _from: Route, next: NavigationGuardNext) {
  if (isAuthenticated()) {
    return next();
  }
  const token = await refresh();
  if (token) return next();
  return next({ name: 'login', query: { redirect: to.fullPath } });
}

export { authGuard };
