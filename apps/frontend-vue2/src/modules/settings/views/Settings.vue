<template>
  <div class="col-12 pt-0">
    <div class="nav-bar-config mb-6">
      <button
        v-for="tab in visibleTabs"
        class="config-button"
        :class="tab.key === activeTab ? 'config-button-active' : ''"
        :key="'settings-nav-' + tab.key"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>
    <GeneralConfig
      :timeZone="currentAccountTimezone"
      :unsubscribeRedirectUrl="unsubscribeRedirectUrl"
      :accountDefaultDomain="accountDefaultDomain"
      v-if="activeTab === 'general'"
    />
    <ApiKeyConfig
      ref="apiKeyConfig"
      :accountId="currentAccount && currentAccount.id ? currentAccount.id : 0"
      v-if="activeTab === 'apikey'"
    />
    <EmailConfig
      :rateLimitUser.sync="rateLimitUser"
      @updateSendUserLimit="updateSendUserLimit"
      v-if="activeTab === 'email'"
    />
    <PushConfig
      :pushScript="pushScript"
      :accountUrl="accountDefaultDomain"
      :pushConfigs.sync="webpush_settings"
      @handleCopy="handleCopy"
      @handleDownloadSw="handleDownloadSw"
      @updatePushConfigs="updatePushConfigs"
      v-if="activeTab === 'push'"
    />
    <WhatsappConfigEvolution
      :numberId="numberId"
      :businessId="businessId"
      :accessToken="accessToken"
      :phoneNumber="phoneNumber"
      :verifiedName="verifiedName"
      @update:numberId="numberId = $event"
      @update:businessId="businessId = $event"
      @update:accessToken="accessToken = $event"
      @update:phoneNumber="phoneNumber = $event"
      @update:verifiedName="verifiedName = $event"
      v-if="activeTab === 'whatsapp' && whatsappProvider === 'evolution'"
    />
    <SegmentCreate v-if="activeTab === 'basesize'" :segmentType="'segment-base-size'" />
    <div class="footer-buttons mt-7">
      <ButtonDefault
        v-if="activeTab === 'email' || activeTab === 'push' || activeTab === 'whatsapp'"
        :name="$t('button.save')"
        type="submit"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
        @click="saveConfig"
      ></ButtonDefault>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { getAccountConfig } from '@/store';
import ToastService from '@/services/toast.service';
import GeneralConfig from '../components/GeneralConfig.vue';
import PushConfig from '../components/PushConfig.vue';
import EmailConfig from '../components/EmailConfig.vue';

import WhatsappConfigEvolution from '../components/WhatsappConfigEvolution.vue';
import ApiKeyConfig from '../components/ApiKeyConfig.vue';
import AccountService from '../services/account.service';
import ApiKeyService from '../services/api-key.service';
import { AccountConfigDto } from '../dtos/accountConfig.dto';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import store from '@/store';
import ModalService from '@/services/modal.service';
import SegmentCreate from '../../segment/views/SegmentCreate.vue';

@Component({
  components: {
    InputDefault,
    ButtonDefault,
    GeneralConfig,
    ApiKeyConfig,
    EmailConfig,
    PushConfig,
    WhatsappConfigEvolution,
    SegmentCreate,
  },
  computed: {
    ...mapState(['currentAccount', 'currentAccountTimezone', 'isSuperAdmin']),
  },
})
export default class Settings extends Vue {
  currentAccount!: AccountDto;
  currentAccountTimezone!: string;
  private readonly toastService = new ToastService();
  private readonly accountService = new AccountService();
  private readonly apiKeyService = new ApiKeyService();
  private readonly modalService = new ModalService();
  public isSuperAdmin!: boolean;
  public isInternal!: boolean;
  public whatsappProvider = process.env.VUE_APP_WHATSAPP_PROVIDER;

  activeTab = 'general';
  apiKey = '';
  apiKeyTracker = '';
  unsubscribeRedirectUrl = '';
  accountDefaultDomain = '';
  formattedDefaultDomain = '';
  pushScript = '';
  webpush_settings = '';
  rateLimitUser = 0;
  urlRegex = /http(s)?:\/\/(www\.)?/g;

  numberId = '';
  businessId = '';
  accessToken = '';
  phoneNumber = '';
  verifiedName = '';

  get visibleTabs() {
    const tabs = [
      { key: 'general', label: this.$t('button.general') },
      { key: 'apikey', label: 'API Key' },
      { key: 'email', label: this.$t('datatable.email') },
    ];

    if (this.isPushActive) {
      tabs.push({ key: 'push', label: 'Push' });
    }

    if (this.isWhatsappActive) {
      tabs.push({ key: 'whatsapp', label: 'Whatsapp' });
    }

    if (this.currentAccount.isInternal) {
      tabs.push({ key: 'basesize', label: 'Base Size' });
    }

    return tabs;
  }

  get isPushActive(): boolean {
    try {
      const raw = getAccountConfig(this.currentAccount, 'webpush_settings');
      if (!raw) {
        return false;
      }
      const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return settings?.isActive === true;
    } catch {
      return false;
    }
  }

  get isWhatsappActive(): boolean {
    try {
      const raw = getAccountConfig(this.currentAccount, 'whatsapp_settings');
      if (!raw) {
        return false;
      }
      const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return settings?.isActive === true;
    } catch {
      return false;
    }
  }

  beforeMount() {
    this.numberId = getAccountConfig(this.currentAccount, 'whatsapp_number_id') ?? '';
    this.businessId = getAccountConfig(this.currentAccount, 'whatsapp_business_id') ?? '';
    this.accessToken = getAccountConfig(this.currentAccount, 'whatsapp_access_token') ?? '';
    this.phoneNumber = getAccountConfig(this.currentAccount, 'whatsapp_phone_number') ?? '';
    this.verifiedName = getAccountConfig(this.currentAccount, 'whatsapp_verified_name') ?? '';

    this.apiKey = getAccountConfig(this.currentAccount, 'api_key');
    this.apiKeyTracker = getAccountConfig(this.currentAccount, 'api_key_tracker') ?? '';
    this.unsubscribeRedirectUrl = getAccountConfig(this.currentAccount, 'unsubscribe_redirect_url') ?? '';
    this.accountDefaultDomain = getAccountConfig(this.currentAccount, 'default_domain') ?? '';
    this.formattedDefaultDomain = `.${this.accountDefaultDomain.replace(this.urlRegex, '')}`;
    this.pushScript = `
    <script>
      const bmsTrkOptions = {
        bmsCookie: 'bmsInfo',
        apiKey: '${this.apiKeyTracker}',
        cookieDomain: '${this.formattedDefaultDomain}',
        cookiesToSearch: ['registeredLead', '_quiz_maker_quiz'],
        autoRequestContact: true,
        startWebPush: true,
        accountHash: '${this.currentAccount.accountHash}'
      };
      window.bmsTrkOptions = bmsTrkOptions;
    <\/script>
    <script async="true" src="https://assets.bri.us/bms/bmstrk.js"><\/script>`;
    this.webpush_settings = JSON.parse(getAccountConfig(this.currentAccount, 'webpush_settings')) ?? {};
    this.rateLimitUser = getAccountConfig(this.currentAccount, 'send_limit_per_user') ?? 0;
  }

  async mounted() {
    let token = this.$route.query.token as string;
    let keyType = this.$route.query.keyType as 'api_key' | 'api_key_tracker';

    // If query params are present, save to sessionStorage in case Auth0 redirect loses them
    if (token && keyType) {
      sessionStorage.setItem('apikey_regen_token', token);
      sessionStorage.setItem('apikey_regen_keyType', keyType);
    } else {
      // Check if we have saved params from a pre-Auth0 redirect
      const savedToken = sessionStorage.getItem('apikey_regen_token');
      const savedKeyType = sessionStorage.getItem('apikey_regen_keyType') as 'api_key' | 'api_key_tracker';
      if (savedToken && savedKeyType) {
        token = savedToken;
        keyType = savedKeyType;
      }
    }

    if (token && keyType) {
      // Clean up sessionStorage
      sessionStorage.removeItem('apikey_regen_token');
      sessionStorage.removeItem('apikey_regen_keyType');
      // Switch to API Key tab
      this.activeTab = 'apikey';

      try {
        const result = await this.apiKeyService.confirmRegeneration(this.currentAccount?.id || 0, token, keyType);

        // Refresh account data in store
        store.commit('updateCurrentAccount');

        // Refresh key status on ApiKeyConfig component
        this.$nextTick(() => {
          const apiKeyConfigRef = this.$refs.apiKeyConfig as any;
          if (apiKeyConfigRef) {
            apiKeyConfigRef.showNewKey(result.newKey);
          }
        });

        // Show new key in modal with copy button — only time the key is visible
        this.showNewKeyModal(result.newKey, keyType);

        // Clear query params from URL without triggering navigation
        this.$router.replace({ path: '/settings' }).catch(() => {});
      } catch (err: any) {
        const status = err?.response?.status;
        const message =
          status === 410 ? (this.$t('apiKey.tokenExpired') as string) : (this.$t('apiKey.invalidToken') as string);

        this.toastService.show({
          type: 'error',
          text: message,
        });

        // Clear query params
        this.$router.replace({ path: '/settings' }).catch(() => {});
      }
    }
  }

  showNewKeyModal(newKey: string, keyType: string) {
    const keyLabel = keyType === 'api_key' ? 'API Key' : 'API Key Tracker';

    const text = `
      <p style="margin-bottom: 12px;">${keyLabel}:</p>
      <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 13px; color: #111827; user-select: all; margin-bottom: 12px;">${newKey}</div>
      <p style="color: #6b7280; font-size: 13px;">${this.$t('apiKey.copyNewKey')}</p>
    `;

    this.modalService.confirm({
      title: `${this.$t('apiKey.newKeyGenerated')}`,
      text,
      confirmLabel: this.$t('apiKey.copyKey') as string,
      cancelLabel: this.$t('button.close') as string,
      isConfirm: true,
      confirmFunction: () => {
        navigator.clipboard.writeText(newKey);
        this.toastService.show({
          type: 'success',
          text: this.$t('apiKey.keyCopied') as string,
        });
      },
      width: 500,
    });
  }

  async downloadFile() {
    const fileContent = `importScripts("https://assets.bri.us/bms/push/bmspush-${this.currentAccount.accountHash}.js");`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent));
    element.setAttribute('download', 'sw.js');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  handleDownloadSw() {
    this.downloadFile();
  }

  handleCopy() {
    const element = document.getElementById('code-textarea') as HTMLInputElement;
    element.focus();
    element.select();
    navigator.clipboard.writeText(this.pushScript);
    this.toastService.show({
      type: 'success',
      text: this.$t('modal.codeCopied') as string,
      leftBorder: false,
    });
  }

  async saveConfig() {
    const updatedAccountConfig: AccountConfigDto[] = [];

    if (this.activeTab === 'whatsapp') {
      updatedAccountConfig.push(
        {
          account_id: this.currentAccount?.id || 0,
          name: 'whatsapp_number_id',
          value: this.numberId,
        },
        {
          account_id: this.currentAccount?.id || 0,
          name: 'whatsapp_business_id',
          value: this.businessId,
        },
        {
          account_id: this.currentAccount?.id || 0,
          name: 'whatsapp_access_token',
          value: this.accessToken,
        },
        {
          account_id: this.currentAccount?.id || 0,
          name: 'whatsapp_phone_number',
          value: this.phoneNumber,
        },
        {
          account_id: this.currentAccount?.id || 0,
          name: 'whatsapp_verified_name',
          value: this.verifiedName,
        }
      );
    } else if (this.activeTab === 'email') {
      updatedAccountConfig.push({
        account_id: this.currentAccount?.id || 0,
        name: 'send_limit_per_user',
        value: this.rateLimitUser,
      });
    } else if (this.activeTab === 'push') {
      updatedAccountConfig.push({
        account_id: this.currentAccount?.id || 0,
        name: 'webpush_settings',
        value: JSON.stringify(this.webpush_settings),
      });
    }

    try {
      await this.accountService.updateAccount(this.currentAccount?.id || 0, updatedAccountConfig);
      store.commit('updateCurrentAccount');
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.configSaved') as string,
        leftBorder: false,
      });
    } catch (e) {
      this.toastService.show({
        type: 'error',
        text: e as string,
        leftBorder: false,
      });
    }
  }

  updatePushConfigs(newPushConfigs: any) {
    this.webpush_settings = newPushConfigs;
  }

  updateSendUserLimit(userLimit: any) {
    this.rateLimitUser = userLimit;
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.nav-bar-config {
  display: flex;
  box-shadow: $shadow-base;
  padding: 10px 15px;
  margin-top: 15px;
  border-radius: 16px;
  gap: 10px;
  background-color: white;

  button {
    font-weight: bold !important;
    font-size: 12px;
  }
}

.config-button {
  color: #a6a6a6;
  border-radius: 8px;
  padding: 5px 12px;
  font-weight: normal !important;

  &:hover {
    background: #f5f5f5;
  }
}

.config-button-active {
  color: $ds-blue;
  background: $ds-blue-100;

  &:hover {
    background: $ds-blue-100;
  }
}
</style>
