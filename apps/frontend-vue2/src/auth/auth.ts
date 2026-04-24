import { VueConstructor } from 'vue';
import AuthService, {
  getAccessToken,
  getCurrentAccessToken,
  isAuthenticated,
  login,
  logout,
  refresh,
} from '@/services/auth.service';
import store from '@/store';

const authService = new AuthService();

export const authPlugin = {
  install(vue: VueConstructor) {
    vue.prototype.$auth = {
      get user() {
        return store.state.currentUser || null;
      },
      get isAuthenticated() {
        return isAuthenticated();
      },
      get token() {
        return getCurrentAccessToken();
      },
      login: (email: string, password: string) => login(email, password),
      logout: () => logout(),
      refresh: () => refresh(),
      getAccessToken: () => getAccessToken(),
      service: authService,
    };
  },
};

export { authService };
