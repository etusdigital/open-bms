import { NavigationGuard } from 'vue-router';
import { useAuth } from '../../composables/useAuth';

export const authGuard: NavigationGuard = async (to) => {
  const { isAuthenticated, refresh } = useAuth();
  if (isAuthenticated.value) return true;
  const token = await refresh();
  if (token) return true;
  return { name: 'login', query: { redirect: to.fullPath } };
};
