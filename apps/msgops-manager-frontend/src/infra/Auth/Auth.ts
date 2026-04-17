import { createAuth0 } from '@auth0/auth0-vue';
import type { AuthConfig } from './Auth.types';

export const authConfig: AuthConfig = {
  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  callbackUrl: import.meta.env.VITE_AUTH0_CALLBACK_URL,
};

export const auth0 = createAuth0({
  domain: authConfig.domain,
  client_id: authConfig.clientId,
  audience: authConfig.audience,
  redirect_uri: authConfig.callbackUrl,
});
