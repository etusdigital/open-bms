<template>
  <header class="header">
    <v-menu :close-on-content-click="false" bottom max-width="280px" v-model="show">
      <template v-slot:activator="{ on }">
        <v-btn class="select-button" v-on="on" @click="openMenu()">
          <v-avatar size="24">
            <img v-if="currentUser.profile" :src="currentUser.profile" alt="" class="image-fit" />
            <v-icon v-else class="profile-picture-menu">{{ getInitialNames() }}</v-icon>
          </v-avatar>
          <span class="account-name-select">{{ accountSelected }}</span>
          <span class="material-symbols-rounded icon-dropdwon font-20" small>arrow_drop_down</span>
        </v-btn>
      </template>
      <v-card class="account-card">
        <div class="close-button-div">
          <span class="material-symbols-rounded close-button font-20 cursor-pointer" @click="show = false">close</span>
        </div>
        <v-list-item-content class="justify-center">
          <div class="mx-auto text-center">
            <v-avatar size="100" class="mt-2">
              <img v-if="currentUser.profile" :src="currentUser.profile" alt="" class="image-fit" />
              <v-icon v-else class="profile-picture">{{ getInitialNames() }}</v-icon>
            </v-avatar>
            <p class="mt-4">
              <span class="username">{{ username }}</span>
            </p>
            <p class="mt-5">
              <span class="account-name-menu">{{ accountSelected }}</span>
            </p>
            <ButtonDefault
              :name="`${$t('button.editProfile')}`"
              to="/profile"
              data-cy="button-profile-edit"
              class="btn btn-c btn-light btn-light-c mb-3 profile-edit"
            />
          </div>
          <div v-if="userAccounts.length > 1" class="mb-0">
            <div class="search-bar pl-2">
              <span class="material-symbols-rounded font-20"> search </span>
              <input
                id="header-menu__accounts-search"
                class="account-input pl-2"
                type="text"
                autocomplete="off"
                :placeholder="`${$t('input.search')}`"
                @input="filterAccountName($event.target.value)"
              />
            </div>
            <div class="accounts-list">
              <v-list-item
                class="item-accounts"
                v-for="(item, index) in accountsFilter"
                :key="`accounts-list-${index}`"
                @click="changeAccount(item)"
                >{{ item.account ? item.account.name : '' }}</v-list-item
              >
            </div>
          </div>
          <div class="user-button">
            <div class="user-actions" v-if="userMaster">
              <span class="material-symbols-rounded font-16 pl-2 pr-2" small>manage_accounts</span>
              <a v-bind:href="manager" class="admin-link">{{ $t('button.manageAccount') }}</a>
            </div>
            <div class="user-actions">
              <span class="material-symbols-rounded pl-2 pr-2 ds-red-color font-20" small>logout</span>
              <a class="logout-link" @click="logout">{{ $t('button.logout') }}</a>
            </div>
          </div>
          <!-- <div class="docs">
            <a to="/" class="docs-msg">{{ $t('menu.policy') }}</a>
            <a to="/" class="docs-msg">{{ $t('menu.terms') }}</a>
          </div> -->
        </v-list-item-content>
      </v-card>
    </v-menu>
  </header>
</template>

<script lang="ts">
import store from '@/store';
import { Component, Vue } from 'vue-property-decorator';
import { mapState } from 'vuex';
import AuthService from '@/services/auth.service';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { UserAccountDto } from '@/modules/accounts/dtos/useraccount.dto';
import ButtonDefault from '../button/ButtonDefault.vue';
import ImageInput from '../input/ImageInputDefault.vue';
import { UserDto } from '@/modules/profile/dtos/user.dto';
import { getAccountConfig } from '@/store';
import AccountService from '@/modules/accounts/services/account.service';
import LoginService from '@/services/login.service';
import { getDefaultRoute } from '@/store';

const auth = new AuthService();
@Component({
  components: { ButtonDefault, ImageInput },
  computed: {
    ...mapState(['currentUser', 'currentAccount', 'userMaster', 'userAccounts']),
  },
})
export default class Header extends Vue {
  private readonly accountService = new AccountService();
  private readonly loginService = new LoginService();
  public userAccounts!: Array<UserAccountDto>;
  public currentAccount!: AccountDto;
  public userMaster!: boolean;
  public currentUser!: UserDto;

  public manager = process.env.VUE_APP_REDIRECT_MANAGER;
  public showSelectAccount = true;

  searchAccount = '';
  accountsFilter: any = [];
  show = false;

  get username(): any {
    return this.currentUser.name;
  }

  get accountSelected(): any {
    return this.currentAccount.name;
  }

  async logout() {
    await auth.logout();
    store.commit('setCurrentAccount', 0);
    this.$router.replace({ name: 'login' }).catch(() => null);
  }

  async beforeMount() {
    if (this.userAccounts.length === 1) {
      this.showSelectAccount = false;
    }

    this.filterAccountName('');
  }

  async filterAccountName(value: string) {
    if (!value) {
      this.accountsFilter = this.userAccounts;
      return;
    }

    this.accountsFilter = this.userAccounts.filter((item: any) => {
      return item.account && item.account.name.toLowerCase().includes(value.toLowerCase());
    });
  }

  getInitialNames() {
    const nameArr = this.username.split(' ');
    const firstName = nameArr[0];
    const lastName = nameArr.pop();
    let initials = '';
    initials += firstName ? firstName[0] : '';
    initials += lastName ? lastName[0] : '';
    return initials;
  }

  async changeAccount(userAccount: UserAccountDto) {
    store.commit('setIsLoadingPageVisible', true);

    // Navigate to default route FIRST to unmount the current page
    // This prevents old components from re-fetching with the new account ID
    await this.$router.push(getDefaultRoute()).catch(() => {});

    store.commit('setAuthReady', false);
    store.commit('setUser', {} as any);
    store.commit('setCurrentAccount', userAccount.account);
    store.commit('setUserMaster', userAccount.isMasterUser);

    const [configs, scopedMe] = await Promise.all([
      this.accountService.getAccountConfigs().then((r) => r.data),
      this.loginService.getMe(userAccount.accountId) as any,
    ]);

    store.commit('setAccountConfig', { id: userAccount.accountId, configs });
    store.commit('setEffectiveRole', scopedMe.data.effectiveRole);
    store.commit('setPermissions', scopedMe.data.permissions || []);
    store.commit('setGlobalRole', scopedMe.data.globalRole || '');
    store.commit('setSuportUser', scopedMe.data.effectiveRole === 'support');
    const membership = scopedMe.data.userAccount?.find((item: any) => item.accountId === userAccount.accountId);
    store.commit('setUserMaster', membership?.isMasterUser || false);

    store.commit('setUser', scopedMe.data);
    store.commit('setAuthReady', true);

    // Check email settings AFTER configs are loaded
    const emailSettingsRaw = configs.find((c: any) => c.name === 'email_settings');
    const emailSettings = emailSettingsRaw ? JSON.parse(emailSettingsRaw.value) : {};
    if (!emailSettings.isActive) {
      await this.$router.push('/messages/access-denied').catch(() => {});
    }

    store.commit('setIsLoadingPageVisible', false);
    this.show = false;
  }

  openMenu() {
    this.show = true;
    setTimeout(() => {
      (document.querySelector('#header-menu__accounts-search') as HTMLElement).focus();
    }, 100);
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

header {
  background-position-x: right;
  background-position-y: top;
  background-repeat: repeat;
  width: fit-content;
  display: flex;
  align-content: flex-end;
  justify-content: space-between;
  justify-items: center;
  margin-left: auto;
  padding-top: 35px;
  flex-direction: row-reverse;
  position: relative;
  z-index: 2;
}
::v-deep.v-menu__content .theme--light .menuable__content__active {
  z-index: 99999 !important;
}
.icon-dropdwon {
  color: $ds-gray !important;
}
.account-name-select {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 600;
  position: absolute;
  margin-left: 40px;
  text-transform: capitalize !important;
}
.profile-picture {
  font-size: 45px !important;
  margin: auto;
  font-weight: bold;
  text-align: center;
  background-color: $ds-blue;
  color: white !important;
  font-family: 'Inter', sans-serif;
}
.profile-picture-menu {
  font-size: 10px !important;
  margin: auto;
  font-weight: bold;
  text-align: center;
  background-color: $ds-blue;
  color: white !important;
  font-family: 'Inter', sans-serif;
}
.image-fit {
  object-fit: cover;
}
.theme--light.v-btn--active:hover::before,
.theme--light.v-btn--active::before {
  opacity: 0 !important;
}
.select-button {
  width: 280px;
  border-radius: 8px;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-color: #ffffff !important;
  margin-right: 40px !important;
  border: 1px solid $ds-gray-300;
  box-shadow: none;
  z-index: 1;
}

.close-button-div {
  flex-flow: row-reverse;
  display: flex;
}
.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
  position: absolute;
}
.close-button,
.v-btn:before {
  background-color: #ffffff !important;
}
.account-input {
  width: 100%;
  min-height: 36px !important;
  outline: none;
  font-size: 12px;
}
.admin-link {
  color: $ds-gray;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}
.username {
  font-style: normal;
  font-weight: 400;
  color: $ds-gray;
  font-size: 12px;
}

.profile-edit {
  box-shadow: none !important;
}
.logout-link {
  color: $ds-red !important;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}
.user-actions {
  border-top: 1px solid $ds-gray-100;
  display: flex;
  min-height: 36px !important;
  flex-direction: revert;
  align-items: center;
}
.user-button {
  display: flex;
  flex-direction: column;
  border-top: 1px solid #a6a6a6;
}
.account-name-menu {
  font-size: 24px;
  color: $ds-gray;
  font-style: normal;
  font-weight: 600;
}
.accounts-list {
  max-height: 11rem;
  overflow-y: scroll;
  margin-bottom: 0px !important;
}
.item-accounts {
  color: $ds-gray;
  min-height: 36px !important;
  border-bottom: 1px solid $ds-gray-100;
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
}
.search-bar {
  min-width: 200px;
  display: flex;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid #a6a6a6;
  margin-bottom: 0px !important;
  justify-content: center;
  align-items: center;
}
.autocomplete-accounts {
  max-width: 200px;
}
.docs {
  display: flex;
  justify-content: space-evenly;
  min-height: 36px !important;
  align-items: center;
}
.docs-msg {
  font-size: 8px;
  color: $ds-gray;
}

::v-deep .v-btn.select-button {
  padding: 0 8px !important;
}
</style>
