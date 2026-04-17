import { NavigationGuardNext, Route } from 'vue-router/types/router';
import AuthService from '@/services/auth.service';

const authService = new AuthService();

async function authGuard(to: Route, from: Route, next: NavigationGuardNext) {
  try {
    const user = await authService.getUser();

    if (!user) {
      await authService.login();
    }
  } catch (err) {
    console.error(err);
  }

  next();
}

export { authGuard };
