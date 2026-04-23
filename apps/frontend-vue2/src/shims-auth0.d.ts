import type { UserDto } from '@/modules/profile/dtos/user.dto';
import type AuthService from '@/services/auth.service';

declare module 'vue/types/vue' {
  interface Vue {
    $auth: {
      readonly user: UserDto | null;
      readonly isAuthenticated: boolean;
      readonly token: string | null;
      login: (email: string, password: string) => Promise<void>;
      logout: () => Promise<void>;
      refresh: () => Promise<string | null>;
      getAccessToken: () => Promise<string | null>;
      service: AuthService;
    };
  }
}
