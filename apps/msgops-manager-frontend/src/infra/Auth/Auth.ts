import type { AuthConfig } from './Auth.types';

export const authConfig: Pick<AuthConfig, never> & { apiBaseUrl: string } = {
  apiBaseUrl: import.meta.env.VITE_API_MSGOPS,
};
