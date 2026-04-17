import { Vue, Component } from 'vue-property-decorator';
import createAuth0Client, {
  PopupLoginOptions,
  Auth0Client,
  RedirectLoginOptions,
  GetIdTokenClaimsOptions,
  GetTokenSilentlyOptions,
  GetTokenWithPopupOptions,
  LogoutOptions,
} from '@auth0/auth0-spa-js';
import { User } from './User';
import store from '@/store';

export interface Auth0Options {
  domain: string;
  clientId: string;
  audience?: string;
  [key: string]: string | undefined;
}

export type RedirectCallback = (appState: any) => void;

@Component({})
export class VueAuth extends Vue {
  loading = true;
  isAuthenticated = false;
  user?: User;
  auth0Client?: Auth0Client | any;
  popupOpen = false;
  error?: Error | any;

  async getUser() {
    return new User(await this.auth0Client?.getUser());
  }

  async loginWithPopup(o: PopupLoginOptions) {
    this.popupOpen = true;

    try {
      await this.auth0Client?.loginWithPopup(o);
    } catch (e) {
      console.error(e);
      this.error = e;
    } finally {
      this.popupOpen = false;
    }

    this.user = await this.getUser();
    this.isAuthenticated = true;
  }

  loginWithRedirect(o: RedirectLoginOptions) {
    return this.auth0Client?.loginWithRedirect(o);
  }

  getIdTokenClaims(o: GetIdTokenClaimsOptions) {
    return this.auth0Client?.getIdTokenClaims(o);
  }

  getTokenSilently(o: GetTokenSilentlyOptions) {
    return this.auth0Client?.getTokenSilently(o);
  }

  getTokenWithPopup(o: GetTokenWithPopupOptions) {
    return this.auth0Client?.getTokenWithPopup(o);
  }

  logout(o: LogoutOptions) {
    return this.auth0Client?.logout(o);
  }

  async init(onRedirectCallback: RedirectCallback, redirectUri: string, auth0Options: Auth0Options) {
    this.auth0Client = await createAuth0Client({
      domain: auth0Options.domain,
      client_id: auth0Options.clientId,
      audience: auth0Options.audience,
      redirect_uri: redirectUri,
    });

    try {
      if (
        window.location.search.includes('error=') ||
        (window.location.search.includes('code=') && window.location.search.includes('state='))
      ) {
        const { appState } = (await this.auth0Client?.handleRedirectCallback()) ?? { appState: undefined };
        onRedirectCallback(appState);
      }
    } catch (e) {
      console.error(e);
      this.error = e;
    } finally {
      this.isAuthenticated = await this.auth0Client?.isAuthenticated();
      this.user = await this.getUser();
      this.loading = false;
      store.commit('setLoadAuth0', true);
    }
  }
}
