import Vue from 'vue';
import Vuex from 'vuex';
import { AutomationDto } from './modules/automations/dtos/automation.dto';
import { AccountDto } from './modules/accounts/dtos/account.dto';
import { UserDto } from './modules/profile/dtos/user.dto';
import AccountService from './modules/accounts/services/account.service';
import { UserAccountDto } from './modules/accounts/dtos/useraccount.dto';

const currentAccountFromLocalstorage = localStorage.getItem('currentAccount') || '{}';
export const getAccountConfig = (account: AccountDto, configName: string) => {
  const filterGlockapp = account?.accountConfigs?.find((config: any) => config.name === configName) || null;
  return filterGlockapp ? filterGlockapp.value : null;
};

const getChannels = (account: AccountDto) => {
  const emailSettings = JSON.parse(getAccountConfig(account, 'email_settings')) || {};
  const smsSettings = JSON.parse(getAccountConfig(account, 'sms_settings')) || {};
  const pushSettings = JSON.parse(getAccountConfig(account, 'webpush_settings')) || {};
  const mobilePushSettings = JSON.parse(getAccountConfig(account, 'mobilepush_settings')) || {};
  const wppSettings = JSON.parse(getAccountConfig(account, 'whatsapp_settings')) || {};
  return {
    hasEmail: emailSettings.isActive ? true : false,
    hasSms: smsSettings.isActive ? true : false,
    hasWebPush: pushSettings.isActive ? true : false,
    hasMobilePush: mobilePushSettings.isActive ? true : false,
    hasWhatsapp: wppSettings.isActive ? true : false,
  };
};

export const hasAccessToModule = (account: AccountDto, accountSetting: string) => {
  if (!account.accountConfigs) {
    return false;
  }

  return account.accountConfigs.find(
    (settings: any) => settings.name === accountSetting && JSON.parse(settings.value).isActive === true
  );
};

const defaultRoutesByPermission: Array<{ permission: string; path: string }> = [
  { permission: 'analytics:dashboard_view', path: '/messages/email/statistics' },
  { permission: 'campaigns:view', path: '/campaigns' },
  { permission: 'automations:view', path: '/automations/emails' },
  { permission: 'messages:view', path: '/messages/email' },
  { permission: 'audience:contacts_view', path: '/contacts' },
  { permission: 'audience:segments_view', path: '/segments' },
  { permission: 'account:settings_view', path: '/settings' },
];

export function getDefaultRoute(): string {
  const state = storeInstance?.state;
  if (!state) {
    return '/messages/email/statistics';
  }
  for (const entry of defaultRoutesByPermission) {
    if (state.effectiveRole === 'super_admin' || state.permissions.includes(entry.permission)) {
      return entry.path;
    }
  }
  return '/access-denied';
}

Vue.use(Vuex);
const storeInstance = new Vuex.Store({
  state: {
    isLoadingPageVisible: true,
    automation: {} as AutomationDto,
    campaignTrigger: 0 as number,
    showSteps: true as boolean,
    selectedCustomFieldTrigger: 0 as number,
    customFields: [] as Array<string>,
    userAccounts: [] as UserAccountDto[],
    currentAccount: JSON.parse(currentAccountFromLocalstorage) as AccountDto,
    sessionStarted: false as boolean,
    userMaster: false as boolean,
    isSuperAdmin: false as boolean,
    isSuportUser: false as boolean,
    isMasterRetentionUser: false as boolean,
    globalRole: '' as string,
    effectiveRole: '' as string,
    permissions: [] as string[],
    userLanguage: '' as string,
    currentUser: {} as UserDto,
    hasGlockApp: getAccountConfig(JSON.parse(currentAccountFromLocalstorage) as AccountDto, 'glock_api_key')
      ? true
      : false,
    currentAccountTimezone: getAccountConfig(
      JSON.parse(currentAccountFromLocalstorage) as AccountDto,
      'time_zone'
    ) as string,
    accountChannels: getChannels(JSON.parse(currentAccountFromLocalstorage) as AccountDto),
    authReady: false as boolean,
    showModalSuppression: false as boolean,
    campaignRulesSchedule: {},
  },
  getters: {
    can: (state) => (permission: string) => {
      return state.effectiveRole === 'super_admin' || state.permissions.includes(permission);
    },
  },
  mutations: {
    setIsLoadingPageVisible(state, isLoadingPageVisible) {
      state.isLoadingPageVisible = isLoadingPageVisible;
    },
    setShowSteps(state, showSteps: boolean) {
      state.showSteps = showSteps;
    },
    setAutomation(state, automation: AutomationDto) {
      state.automation = automation;
    },
    setUserAccounts(state, userAccounts: UserAccountDto[]) {
      state.userAccounts = userAccounts;
    },
    setCurrentAccount(state, account: AccountDto) {
      state.currentAccount = account;
      state.hasGlockApp = getAccountConfig(account, 'glock_api_key') ? true : false;
      state.currentAccountTimezone = getAccountConfig(account, 'time_zone');
      localStorage.setItem('currentAccount', JSON.stringify(account));
    },
    setCustomFields(state, customFields: Array<string>) {
      state.customFields = customFields;
    },
    setSessionStarted(state, sessionStarted: boolean) {
      state.sessionStarted = sessionStarted;
    },
    setUserMaster(state, userMaster) {
      state.userMaster = userMaster;
    },
    setUserLanguage(state, userLanguage) {
      state.userLanguage = userLanguage;
      localStorage.setItem('userLanguage', userLanguage);
    },
    setUser(state, user: UserDto) {
      state.currentUser = user;
    },
    setSuperAdmin(state, value: boolean) {
      state.isSuperAdmin = value;
    },
    setSuportUser(state, value: boolean) {
      state.isSuportUser = value;
    },
    setMasterAdminRetention(state, value: boolean) {
      state.isMasterRetentionUser = value;
    },
    setGlobalRole(state, value: string) {
      state.globalRole = value || '';
    },
    setEffectiveRole(state, value: string) {
      state.effectiveRole = value || '';
    },
    setPermissions(state, value: string[]) {
      state.permissions = Array.isArray(value) ? value : [];
    },
    setAuthReady(state, value: boolean) {
      state.authReady = value;
    },
    setCampaignRulesSchedule(state, value) {
      state.campaignRulesSchedule = value;
    },
    setAccountConfig(state, account) {
      state.userAccounts.forEach((item) => {
        if (item.accountId === account.id) {
          item.account.accountConfigs = account.configs;
        }
      });
      state.currentAccount.accountConfigs = account.configs;
      state.accountChannels = getChannels(state.currentAccount);
      state.currentAccountTimezone = getAccountConfig(state.currentAccount, 'time_zone');
    },
    async updateCurrentAccount(state) {
      const accountService = new AccountService();
      const response = await accountService.getAccount(state.currentAccount.id || 0);
      state.currentAccount = response?.data || state.currentAccount;
    },
    toggleModalSuppression(state) {
      state.showModalSuppression = !state.showModalSuppression;
    },
    closeModalSuppression(state) {
      state.showModalSuppression = false;
    },
  },
});
export default storeInstance;
