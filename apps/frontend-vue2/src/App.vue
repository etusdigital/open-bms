<template>
  <v-app>
    <router-view v-if="$route && $route.meta && $route.meta.public" />
    <div id="app" v-else-if="loadAuth0 && currentUser.id">
      <Sidebar>
        <template slot="app-content">
          <Header username="username" />
          <router-view />
        </template>
      </Sidebar>
      <modals-container />
      <Toast></Toast>
    </div>
    <div v-if="!($route && $route.meta && $route.meta.public) && isLoadingPageVisible" class="div-loading">
      <LoginUser :isLoading="isLoadingPageVisible" :color="'white'" />
    </div>
  </v-app>
</template>

<script lang="ts">
import Header from '@/components/layout/Header.vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Footer from '@/components/layout/Footer.vue';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { eventHub } from './services/loading.service';
import MathUtilService from './services/mathUtil.service';
import Toast from '@/components/common/Toast.vue';
import AuthService from './services/auth.service';
import LoginService from './services/login.service';
import store from '@/store';
import { mapState } from 'vuex';
import LoginUser from './components/loading-page/loadingPage.vue';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { UserDto } from './modules/profile/dtos/user.dto';
import AccountService from '@/modules/accounts/services/account.service';

@Component({
  components: { Header, Sidebar, Footer, Toast, LoginUser },
  providers: [ModalService, MathUtilService],
  computed: {
    ...mapState(['loadAuth0', 'isLoadingPageVisible', 'currentUser', 'currentAccount']),
  },
})
export default class App extends Vue {
  private readonly accountService = new AccountService();
  auth = new AuthService();
  loginService = new LoginService();
  isLoggedIn = false;
  spinnerVisible = false;
  loadAuth0!: boolean;
  currentAccount!: AccountDto;
  currentUser!: UserDto;
  isLoadingPageVisible!: boolean;

  showSpinner() {
    this.spinnerVisible = true;
  }

  hideSpinner() {
    this.spinnerVisible = false;
  }

  async mounted() {
    if (this.$route?.meta?.public) {
      return;
    }
    const isAuthenticated = await this.auth.getisAuthenticated();
    if (!isAuthenticated) {
      const redirect = window.location.pathname + window.location.search;
      this.$router.replace({ name: 'login', query: redirect ? { redirect } : {} }).catch(() => null);
      return;
    }
    store.commit('setLoadAuth0', true);
  }

  @Watch('loadAuth0')
  async isAuthenticated() {
    if (this.loadAuth0) {
      try {
        const savedAccountId = this.currentAccount?.id || undefined;
        const me: any = await this.loginService.getMe(savedAccountId);

        store.commit('setUserLanguage', me.data.settings['language']);
        store.commit('setUserAccounts', me.data.userAccount);
        store.commit('setGlobalRole', me.data.globalRole);
        store.commit('setSuperAdmin', me.data.globalRole === 'super_admin');
        this.$i18n.locale = me.data.settings['language'];

        const userAccount = me.data.userAccount.find((account: any) => account.accountId === this.currentAccount.id);
        if (userAccount) {
          store.commit('setUserMaster', userAccount.isMasterUser);
          store.commit('setCurrentAccount', userAccount.account);
          const currentConfigs = (await this.accountService.getAccountConfigs()).data;
          store.commit('setAccountConfig', { id: userAccount.accountId, configs: currentConfigs });
          store.commit('setEffectiveRole', me.data.effectiveRole);
          store.commit('setPermissions', me.data.permissions || []);
          store.commit('setSuportUser', me.data.effectiveRole === 'support');
          store.commit('setUser', me.data);
          store.commit('setAuthReady', true);
          return;
        }

        const firstAccount = me.data.userAccount[0];
        store.commit('setCurrentAccount', firstAccount.account);
        const configs = (await this.accountService.getAccountConfigs()).data;
        store.commit('setUserMaster', firstAccount.isMasterUser);
        store.commit('setAccountConfig', { id: firstAccount.accountId, configs });
        const firstAccountMe: any = await this.loginService.getMe(firstAccount.accountId);
        store.commit('setEffectiveRole', firstAccountMe.data.effectiveRole);
        store.commit('setPermissions', firstAccountMe.data.permissions || []);
        store.commit('setSuportUser', firstAccountMe.data.effectiveRole === 'support');
        store.commit('setUser', firstAccountMe.data);
        store.commit('setAuthReady', true);
      } catch (error) {
        console.log('Could not signing user', error);
        store.commit('setCurrentAccount', 0);
        store.commit('setAuthReady', true);
      }
    }
  }

  @Watch('currentAccount')
  async onCurrentAccountChanged(newAccount: AccountDto, oldAccount: AccountDto) {
    if (!store.state.authReady || !this.loadAuth0 || !newAccount?.id || newAccount?.id === oldAccount?.id) {
      return;
    }

    try {
      const scopedMe: any = await this.loginService.getMe(newAccount.id);
      store.commit('setEffectiveRole', scopedMe.data.effectiveRole);
      store.commit('setPermissions', scopedMe.data.permissions || []);
      store.commit('setGlobalRole', scopedMe.data.globalRole || '');
      store.commit('setSuportUser', scopedMe.data.effectiveRole === 'support');
      store.commit('setUser', scopedMe.data);

      const membership = scopedMe.data.userAccount?.find((item: any) => item.accountId === newAccount.id);
      store.commit('setUserMaster', membership?.isMasterUser || false);
    } catch (error) {
      console.log('Could not refresh scoped permissions', error);
    }
  }

  created() {
    eventHub.$on('show', this.showSpinner);
    eventHub.$on('hide', this.hideSpinner);
  }

  beforeDestroy() {
    eventHub.$off('show', this.showSpinner);
    eventHub.$off('hide', this.hideSpinner);
  }
}
</script>

<style lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';
@import '@/assets/styles/tooltip.scss';
@import '@/assets/styles/automations.scss';

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&display=swap');

/* MAIN */
#app {
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100%;
}

.div-loading {
  z-index: 9 !important;
}

.material-symbols-rounded {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.theme--light.v-data-table > .v-data-table__wrapper > table > tbody > tr > td {
  font-size: clamp(1.2rem, 1vw, 1.4rem) !important;
}

.theme--light.v-data-table > .v-data-table__wrapper > table > tbody > tr > td.action-cell {
  position: sticky;
  top: 0;
  right: 0;
}

.theme--light.v-data-table > .v-data-table__wrapper > table > tbody > tr:hover {
  background: transparent !important;
  box-shadow: inset 1px 0 0 $ds-gray-300, inset 0px 0 0 $ds-gray-300, 0 1px 2px 0 rgba(60, 64, 67, 0.3),
    0 1px 3px 1px rgba(60, 64, 67, 0.15);
}

.v-navigation-drawer,
.v-navigation-drawer__content {
  overflow: visible;
}

.v-navigation-drawer {
  border-top-left-radius: 100px;
  border-top-right-radius: 100px;
}

.v-navigation-drawer__content {
  border-top-left-radius: 100px;
  border-top-right-radius: 100px;
}

.v-navigation-drawer__border {
  height: 0 !important;
}

#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  font-family: 'Inter', sans-serif !important;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}

body {
  background-color: $ds-gray-100 !important;
  font-family: 'Inter', sans-serif !important;
}

.disable-swipe-navigation {
  overscroll-behavior-x: none;
}

.button-outlined {
  border: $ds-blue 2px solid !important;
  color: $ds-blue !important;
  background-color: $ds-gray-100 !important;
}

.button-secondary {
  border-radius: 8px;
  border: $ds-blue 2px solid;
  color: $ds-blue;
  padding: 8px 12px;
  display: flex;
  text-align: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 100%;

  &:hover {
    background-color: $ds-blue;
    color: white;
  }
}

.theme--light.v-btn {
  letter-spacing: normal;
}
.theme--light.v-btn:disabled {
  color: white;
}

// a, a:hover {
//   text-decoration: none !important;
// }

::placeholder,
.multiselect__placeholder,
.note-placeholder,
::-webkit-input-placeholder,
:-ms-input-placeholder {
  /* Chrome, Firefox, Opera, Safari 10.1+ */
  color: $neutral-gray-800 !important;
  opacity: 0.33 !important;
}

/* GENERAL */
.c-title {
  font-style: normal;
  font-weight: 700;
  font-size: 20px;
  line-height: 29px;
  color: $ds-gray;
  margin-bottom: 0px !important;
}
.button-add {
  display: flex;
  background-color: #0fb75c;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
}
.v-icon-plus {
  color: #ffffff !important;
  display: flex;
  align-items: center;
  transition-duration: 0.8s !important;
  font-size: 20px;
  margin-left: 1px;
}

.button-create {
  background-color: $ds-blue;
  text-decoration: none;
  border-radius: 50px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  max-width: 22px;
  transition: max-width 0.5s;
  margin-bottom: 2px;

  &:hover {
    max-width: 300px;

    .v-icon-plus {
      transform: rotateZ(90deg);
    }
  }
}

.add-button {
  display: flex;
  align-items: center;
  background: $ds-blue;
  color: $neutral-basic-white;
  text-transform: uppercase;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  height: 26px !important;
  padding: 8px 12px 8px 12px !important;
  text-align: center;
  border: 1px solid $ds-blue;
}

.buttons-specs {
  display: flex;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  box-shadow: none;
  font-weight: 700;
  font-size: 10px;
  max-height: 26px !important;
  padding: 15px !important;
}

.add-span {
  white-space: nowrap;
  padding: 1px 15px 0 4px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
}

.c-card {
  position: inherit !important;
  margin-bottom: 20px !important;
  margin-left: 50px;
  min-height: 620px;
  padding-bottom: 32px;
  top: 0;
  background: none !important;
  border: none !important;
  padding-right: 70px;
}

.background-card {
  background-color: #ffffff;
  margin-bottom: 24px;
  border-radius: 16px !important;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
}

.c-cards {
  margin-left: 25px !important;
  margin-right: 25px !important;
  margin-bottom: 20px !important;
  min-height: 620px;
  border-radius: 16px;
  height: 100%;
}

.c-subtitle {
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 17px;
  color: $neutral-gray-700;
}

.sub-title {
  color: #a6a6a6;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.clickable-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  z-index: 1;
  &:hover {
    text-decoration: none !important;
  }

  & > a img {
    margin-top: -2px;
  }

  & > span {
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.1em;
  }

  & > a {
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.1em;
  }
}

.title-edit {
  margin-top: -44px !important;
  width: fit-content;
}
.module {
  top: 72px !important;
  position: absolute;
  width: 100%;
}

p {
  font-size: 12px;
  line-height: 14px;
  color: $neutral-gray-700;
}
.cursor-pointer {
  cursor: pointer;
}
.large-img {
  width: 380px;
}
::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1) !important;
}
.v-data-table-header__icon {
  color: $ds-blue !important;
  margin-left: 5px !important;
  margin-bottom: 4px !important;
}
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
.datetime-wrapper {
  white-space: nowrap;
}
.message-type-icon {
  margin-right: 10%;
}

/* BUTTONS */
.button {
  background: $ds-blue !important;
  border-radius: 8px !important;
  padding: 10px 30px !important;
  color: #ffffff !important;
  opacity: 1 !important;
  text-transform: uppercase;

  &:hover {
    background: $ds-blue-dark !important;
  }
}

.button-outlined {
  border: $ds-blue 2px solid !important;
  color: $ds-blue !important;
  background-color: $ds-gray-100 !important;
}

.btn-success-c {
  background: $ds-blue !important;
  border-radius: 4px !important;
  border: none !important;
}

.btn-light-c {
  background: $ds-blue !important;
  color: #ffffff !important;
}

.btn-c {
  text-transform: uppercase;
  font-weight: 600 !important;
  font-size: 12px !important;
  padding: 8px 16px !important;
  letter-spacing: 0.07em !important;
  border-radius: 4px !important;
  border: none !important;
}

.btn-c-sm {
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.07em;
  border-radius: 4px;
  border: none;
}

.btn-call-to-action {
  width: 207px;
  height: 50px;
  left: 379.5px;
  top: 0px;
  background: $ds-blue;
  border-radius: 4px;
  padding: 16px 32px;
  margin: 16px 0px;
}
.footer-buttons {
  display: flex;
  align-items: center;
  place-content: flex-end;
  gap: 22px;
  place-self: flex-end;
  width: 100%;
}
.cancel-button {
  color: $ds-blue;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
}
button.btn-back {
  padding: 12px 24px;
  background-color: $ds-gray-100;
  color: $ds-blue;
  border: $ds-blue solid 2px;
  border-radius: 8px;
  text-transform: uppercase;
  font-style: normal;
  font-weight: 700;
  font-size: 12px;
  line-height: 100%;
  transition: all 0.2s ease-out;

  &:hover {
    color: #fff;
    background-color: $ds-blue;
  }
}

.btn.disabled,
.btn:disabled {
  opacity: 0.33 !important;
}
.btn-c i {
  font-size: 13px;
  margin-right: 10px !important;
  margin-top: 3px !important;
}
.btn-c-sm i {
  font-size: 13px;
  margin-right: 0 !important;
  margin-top: 3px !important;
}
.theme--light.v-input--switch .v-input--switch__track.primary--text {
  background-color: $ds-blue !important;
  opacity: 1 !important;
}
.v-input--switch__thumb .theme--light {
  color: #ffffff !important;
}
.theme--light.v-input--switch .v-input--switch__thumb {
  color: #ffffff !important;
}

.form-field,
.subtitle {
  margin-bottom: 16px !important;
}
.border-color {
  border: 1px solid $ds-gray-300 !important;
}
.form-control {
  box-sizing: border-box !important;
  border-radius: 8px !important;
  height: 36px !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  // width: 283px;
  border: 1px solid $ds-gray-300 !important;
}

/* MULTISELECT */
.multiselect__tag,
.multiselect__tag-icon:hover {
  background: #6c757d9e !important;
}

.multiselect__tag-icon:after {
  content: '\D7';
  color: #212529;
  font-size: 14px;
}

.multiselect__tag {
  background-color: $neutral-gray-300 !important;
  color: $neutral-gray-800 !important;
  border-radius: 8px !important;
  padding: 2px 5px !important;
  margin: 0 10px 0 0 !important;
  min-height: 17px !important;
  line-height: 17px !important;
}

.multiselect__tags {
  cursor: pointer !important;
  border: 1px solid $ds-gray-300 !important;
  padding: 5px 40px 2px 8px !important;
  min-height: 21px !important;
  line-height: 17px !important;
  height: 36px !important;
  border-radius: 8px !important;
}

.multiselect__placeholder,
.multiselect__input {
  padding: 0 !important;
  margin: 3px 0 3px 0 !important;
  line-height: 22px !important;
  min-height: 21px !important;
}
.multiselect__input,
.multiselect__single {
  line-height: 22px !important;
}
.multiselect,
.multiselect__input,
.multiselect__single {
  font-size: 14px !important;
}

.multiselect__content {
  padding-left: 0 !important;
}

.default-filters {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  max-width: fit-content;
  flex: 1;
}
.advanced-filters {
  gap: 10px;
  display: flex;
  flex-direction: row;
}
.default-filters-messages {
  display: flex;
  justify-content: space-between;
}
.advanced-select {
  width: 283px !important;
}

.select-items-per-page {
  outline: none;
  min-width: 60px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--cinzas-gray-300, #d9d9d9);
  background-color: #ffffff;
  padding-left: 8px;
  padding-right: 3%;
  display: flex;
  align-items: center;
  appearance: none;
  background-image: url('../src/assets/select-icon.svg');
  background-repeat: no-repeat;
  background-position: right 0.5rem top 50%;
  background-size: 0.65rem auto;
}

.select-items-per-page:active {
  background-image: url('../src/assets/select-icon-up.svg');
  background-repeat: no-repeat;
  background-position: right 1.2rem top 50%;
  background-size: 1rem auto;
}

.custom__select {
  position: absolute !important;
  width: 40px !important;
  height: 33px !important;
  right: 1px !important;
  top: 1px !important;
  line-height: 33px !important;
  font-size: 17px !important;
  padding: 0 !important;
  text-align: center !important;
  color: $neutral-gray-500 !important;
  cursor: pointer !important;
}

.multiselect__option {
  padding: 4px 12px !important;
  min-height: 25px !important;
  height: 25px !important;
}
.multiselect__option--highlight {
  background: $neutral-gray-300 !important;
  color: $neutral-basic-Black !important;
}

.multiselect__content-wrapper {
  border: 1px solid $neutral-gray-500 !important;
}

.multiselect--active {
  .custom__select {
    transform: rotate(180deg) !important;
  }
}

.custom__tag-label {
  font-family: 'Inter', sans-serif !important;
  font-style: normal !important;
  font-weight: normal !important;
  font-size: 14px !important;
  line-height: 17px !important;
  margin: 0px 8px !important;
}

.custom__tag-icon {
  width: 11px !important;
  height: 11px !important;
  font-size: 11px !important;
}

/* SPINNER */
.spinner {
  position: absolute;
  top: 50%;
  -ms-transform: translateY(-50%);
  transform: translateY(-50%);
  left: 50%;

  &-wrapper {
    width: 100%;
    height: 100%;
    background: #000000ba;
    position: fixed;
    z-index: 9999;
    margin: 0 auto !important;
    transition: 0.7s;
  }
}

.dropdown-toggle::after {
  display: none;
}

.v-list {
  padding: 0 !important;
}
.v-list-item {
  padding: 4px 12px !important;
  min-height: 25px !important;
}
.v-list-item:hover {
  background-color: $neutral-gray-300;
}
.v-list-item__content {
  padding: 0 !important;
}
.v-list-item__title {
  font-size: 14px !important;
  line-height: 16.8px !important;
}

/* NOTIFICATIONS */
.v--modal {
  height: auto !important;
  background: $ds-gray-100 !important;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px !important;
}
.v--modal-box {
  overflow: visible !important;
}
.notification-title {
  letter-spacing: 1px;
  text-transform: uppercase;
  font-size: 10px;
  color: #061f3a;
}

.c-toast {
  top: 106px;
  right: 22px;

  .v-sheet.v-snack__wrapper:not(.v-sheet--outlined) {
    box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  }
  .v-snack__wrapper {
    min-width: 464px;
  }

  .rounded {
    border-radius: 8px !important;
  }
  .c-toast-content {
    line-height: 17px;
    font-weight: bold;
    font-style: normal;
    font-size: 14px;
    padding: 16px;
  }

  .v-snack__action {
    margin-right: 16px;
  }
  .v-snack__btn {
    font-size: 16px;
  }
}

.c-disabled {
  color: $neutral-gray-500;
  border-color: $neutral-gray-500;
  opacity: 0.8;
}
.c-disabled input {
  background: white;
}
.note-placeholder {
  color: $neutral-gray-800 !important;
  opacity: 0.33;
}
.c-disabled::placeholder {
  color: $neutral-gray-500;
  opacity: 0.8;
}
.form-control:disabled {
  background: #f3f3f3 !important;
}

/* TABLES */
.c-table .v-table {
  border-bottom: 1px solid $neutral-gray-700;
}

.c-table thead th {
  padding: $spacing-sm $spacing-lg !important;

  span {
    font-weight: bold;
  }
}
.c-table tbody td {
  &:last-child {
    padding-right: $spacing-sm $spacing-sm !important;
  }
  &:not(:last-child) {
    padding: $spacing-sm $spacing-sm !important;
  }
}
.v-data-table__wrapper > table > thead > tr > th {
  padding: $spacing-sm $spacing-sm !important;
}
.c-table tbody td,
.c-table thead th span {
  color: $neutral-gray-700;
  font-size: 14px;
  line-height: 17px;
}

.c-simple-table th {
  font-weight: 400;
  font-size: 16px !important;
  line-height: 19px;
  text-transform: uppercase;
  color: $neutral-gray-800 !important;
  border: none;
}

.c-simple-table td {
  font-size: 16px !important;
  line-height: 19px;
  color: $neutral-gray-800;
}

.c-pagination {
  .v-pagination__item,
  .v-pagination__navigation {
    font-size: clamp(1.2rem, 1vw, 1.4rem);
    box-shadow: none;
    border: solid $neutral-gray-400 1px;
    height: 32px;
    min-width: 32px;
  }
}
.pagination {
  place-content: center;
}

// autocomplete
.c-autocomplete {
  background: $neutral-basic-white;
  border: 1px solid $neutral-gray-500;
  box-sizing: border-box;
  border-radius: $spacing-xxs;

  .v-select__slot {
    height: 31px;
  }
}

.v-autocomplete__content.v-menu__content {
  box-shadow: none !important;
  border: 1px solid $neutral-gray-500;
  border-radius: 4px !important;
}
.v-menu__content {
  border-radius: 8px !important;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
}

.v-list-item__action {
  margin: 6px 0 6px 0;
}
.v-application--is-ltr .v-list-item__action:first-child,
.v-application--is-ltr .v-list-item__icon:first-child {
  margin-right: 12px;
}

#app
  > div.sidebar
  > main
  > div
  > div
  > div
  > div
  > div
  > div.col-12.nopadding-bottom
  > div
  > div.active-automation.row.col-12.nopadding-right.nopadding-left
  > div.v-input.col-6.switch.automation_options-enable-switch.nopadding-right.nopadding-left.v-input--is-label-active.v-input--is-dirty.theme--light.v-input--selection-controls.v-input--switch.v-input--switch--inset
  > div
  > div.v-input__slot
  > div
  > div.v-input--switch__thumb.theme--light {
  color: white !important;
  caret-color: white !important;
  width: 18px;
  height: 18px;
  top: calc(50% - 9px);
  transform: translate(18px, 1px) !important;
}
.theme--light.v-application {
  background: $ds-gray-100 !important;
}
.c-menu {
  background: #ffffff;
  border: 1px solid $neutral-gray-500;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  width: 149px;
  min-width: 149px !important;
}

.c-menu .v-list-item {
  max-height: 32px;
  padding: 6px 9px !important;
}

.c-menu .actions_item img:hover {
  opacity: 0.8;
}

.v-list.actions.v-sheet {
  display: flex;
  width: 149px;
}
div.c-search > div.v-input__control > div.v-input__slot > div.v-select__slot > input {
  padding: 4px 0 !important;
}

.v-input__slot {
  min-height: 36px !important;
}

.v-input__control {
  height: 36px !important;
}

.text-autocomplete-option {
  max-width: 310px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  line-height: 17px;
}

.subtext-autocomplete-option {
  color: #aaa;
  font-size: 14px;
  line-height: 17px;
  white-space: nowrap;
  margin-left: 4px;
}
.list-fields-modal-title {
  font-weight: bold;
  font-size: 16px;
  line-height: 19px;
}

fieldset {
  border: 1px solid $ds-gray-300 !important;
}

.view-fields,
.select-trigger-fields {
  .filter {
    .multiselect {
      min-height: 33px;
    }

    .multiselect__tags {
      border-radius: 8px;
      border: 1px solid $ds-gray-300 !important;
      padding: 6px 40px 0px 8px;
      height: 36px;
      min-height: 36px;
    }
    .multiselect__tag {
      background-color: $neutral-gray-300 !important;
      color: $neutral-gray-800;
      border-radius: 8px;
      padding: 2px 5px;
      height: 21px;
    }

    .multiselect__placeholder {
      padding-top: 0;
      color: $neutral-gray-800;
      opacity: 0.33;
    }

    .custom__select {
      position: absolute;
      width: 40px;
      height: 33px;
      right: 1px;
      line-height: 33px;
      font-size: 17px;
      padding: 0;
      text-align: center;
      color: $neutral-gray-500;
      cursor: pointer;
    }

    .multiselect__option {
      padding: 8px 16px;
      min-height: 25px;
      height: 33px;
    }
    .multiselect__option--highlight {
      background: $neutral-gray-300 !important;
      color: $neutral-basic-Black !important;
    }

    .multiselect__content-wrapper {
      border: 1px solid $neutral-gray-500 !important;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
    }

    .multiselect--active {
      .custom__select {
        transform: rotate(180deg);
      }
    }

    .custom__tag-label {
      font-family: 'Inter', sans-serif;
      font-style: normal;
      font-weight: normal;
      font-size: 14px;
      line-height: 17px;
      margin: 0px 8px;
    }

    .custom__tag-icon {
      width: 11px;
      height: 11px;
      font-size: 11px;
    }
    .multiselect__content {
      padding-left: 0 !important;
    }

    .option__title {
      text-transform: capitalize;
    }
  }
}

.icon-spin {
  animation: icon-spin 2s infinite;
  display: inline-block;
}

.spinner-wrapper {
  padding-top: 22em;
  display: block;
  left: 0;
  overflow: hidden;
  position: fixed;
  right: 0;
  text-align: center;
  top: 0;
}
@keyframes icon-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.config-span {
  margin-top: 20px;
  margin-bottom: 10px;
}

.textarea-wrapper {
  position: relative;
}

.textarea-wrapper button {
  position: absolute;
  top: 15px;
  right: 40px;
}

.script-code {
  height: 350px;
  width: 98.5%;
  cursor: pointer;
  background-color: $ds-gray-100;
  border: $ds-gray 1px solid;
  border-radius: 16px;
  resize: none;
}

.default-filters__search-input {
  width: 280px;
}

.no-underline,
a.button {
  text-decoration: none !important;
}

.button-copy img {
  height: 24px;
}
.button-copy:hover img {
  filter: invert(79%) sepia(9%) saturate(15%) hue-rotate(70deg) brightness(92%) contrast(87%);
}
.button-trash img {
  height: 24px;
}

.button-trash:hover img {
  filter: invert(27%) sepia(73%) saturate(6631%) hue-rotate(351deg) brightness(102%) contrast(88%);
}

.input-bms {
  width: auto;
  padding: 8px 10px 8px 10px;
  border-radius: 8px;
  border: 1px solid $ds-gray-300;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: $ds-gray;
  &:focus {
    border: 1px solid $ds-blue;
  }
  &:disabled {
    background-color: $ds-gray-100;
    color: $ds-gray;
  }
}

.custom-checkbox {
  position: relative;
  display: flex;
  align-items: center;

  input {
    width: 12px;
    height: 12px;
    background-color: white;
    border-radius: 4px;
    vertical-align: middle;
    border: 1px solid $ds-gray-300;
    appearance: none;
    outline: none;
    cursor: pointer;
    transition: all 0.1s ease-out;

    &:checked {
      border-color: $ds-blue;
      background-color: $ds-blue;
    }

    &:after {
      position: absolute;
      color: #ffffff;
      border-top: none;
      border-right: none;
      width: 6px;
      height: 4px;
      opacity: 0;
      top: 2px;
      left: 2px;
      content: '✓';
      font-size: 9px;
      font-weight: 800;
    }

    &:checked:after {
      opacity: 1;
    }
  }

  label {
    margin-left: 8px;
  }
}

.status-chip {
  display: inline-flex;
  min-width: 110px !important;
  height: 24px;
  justify-content: center;
  align-items: center;
  white-space: nowrap;
  text-align: center;
  font-size: clamp(1rem, 1vw, 1.2rem) !important;
  font-style: normal;
  font-weight: 600;
  line-height: 15px;
  letter-spacing: 0.05px;
  padding: clamp(14px, 1vw, 16px);
  border-radius: 20px;
}

.status-stopped,
.status-inactive {
  color: #f03232;
  background: #fff0f0;
}
.status-completed,
.status-active {
  color: #0fb75c;
  background: #f2fff8;
}

.preview-email-iframe {
  width: 100%;
  min-height: 300px;
  border: none;
}

.label-color {
  color: $ds-gray;
}

::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

select.mo-select {
  background-image: linear-gradient(45deg, transparent 50%, gray 50%),
    linear-gradient(135deg, gray 50%, transparent 50%);
  background-position: calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px);
  background-size: 6px 6px;
  background-repeat: no-repeat;
}

select.mo-select:focus {
  border: 1px solid $ds-blue !important;
}

select.mo-select:active {
  background-image: linear-gradient(45deg, $ds-blue 50%, transparent 50%),
    linear-gradient(135deg, transparent 50%, $ds-blue 50%);
  background-position: calc(100% - 15px) 1em, calc(100% - 20px) 1em;
  background-size: 6px 6px;
  background-repeat: no-repeat;
  outline: 0;
  border: 1px solid $ds-blue !important;
}

.v-popper--theme-info-tooltip,
.v-popper__inner {
  background: $ds-gray !important;
  color: $neutral-basic-white !important;
  border-radius: 4px !important;
  font-size: 10px !important;
  font-style: normal !important;
  padding: 8px !important;
  font-weight: 400 !important;
  line-height: 17px !important;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.2) !important;
  max-width: 305px;

  p {
    font-size: 10px;
    color: white;
  }
}
.v-popper__arrow-inner,
.v-popper__arrow-outer {
  border-color: $ds-gray !important;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.2) !important;
}

.v-popper--theme-info-tooltip,
.v-popper__inner:hover::before {
  transition-property: opacity, transform !important;
  transition-delay: 0.2s !important;
  transition-duration: 0.1s !important;
  transform: translateX(-50%) scaleY(1) !important;
}

.v-popper__popper--hidden,
.v-popper__popper--hide-to {
  transition-property: opacity, transform !important;
  transition-delay: 0.2s !important;
  transition-duration: 0.1s !important;
  transform: translateX(-50%) scaleY(1) !important;
}
.icon-active:hover {
  color: $ds-gray;
}

.unfilled-icon {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important;
}
</style>
