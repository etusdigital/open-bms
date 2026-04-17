import Vue from 'vue';

export default class AuthService {
  public async getUser() {
    return await Vue.prototype.$auth.user;
  }

  public async getAccessToken() {
    const data = await Vue.prototype.$auth.getTokenSilently({});
    return data;
  }

  public async getisAuthenticated() {
    return await Vue.prototype.$auth.isAuthenticated;
  }

  public async login() {
    await Vue.prototype.$auth.loginWithRedirect({});
    return await this.getAccessToken();
  }

  public async logout() {
    Vue.prototype.$auth.logout({});
  }

  private async setStorageRedirectLogin() {
    if (window.location.origin + '/' !== window.location.toString()) {
      sessionStorage.setItem('redirect_after_login', `${window.location}`);
    }
  }
}
