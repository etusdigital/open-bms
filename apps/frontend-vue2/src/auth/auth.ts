import { VueConstructor } from 'vue';
import { VueAuth, Auth0Options, RedirectCallback } from './VueAuth';

interface Auth0PluginOptions {
  onRedirectCallback: RedirectCallback;
  domain: string;
  clientId: string;
  audience?: string;
  [key: string]: string | RedirectCallback | undefined;
}

const DEFAULT_REDIRECT_CALLBACK = (appState: any) =>
  window.history.replaceState({}, document.title, window.location.pathname);

let instance: VueAuth;

export const getInstance = () => instance;

export const useAuth0 = ({
  onRedirectCallback = DEFAULT_REDIRECT_CALLBACK,
  redirectUri = window.location.origin,
  ...options
}) => {
  if (instance) {
    return instance;
  }

  instance = new VueAuth();
  instance.init(onRedirectCallback, redirectUri, options as Auth0Options);

  return instance;
};

export const auth0Plugin = {
  install(vue: VueConstructor, options: Auth0PluginOptions) {
    vue.prototype.$auth = useAuth0(options);
  },
};
