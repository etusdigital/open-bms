<template>
  <div>
    <label class="label-title pb-0 font-16">API Keys</label>
    <v-card class="background-card message-form mt-0">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <!-- API Key -->
        <div>
          <label class="key-label font-12">API Key</label>
          <div class="key-display-row">
            <div class="key-value">
              {{ $t('apiKey.hiddenMessage') }}
            </div>
            <div class="key-actions">
              <ButtonDefault
                :name="$t('apiKey.generate')"
                :loading="loadingApiKey"
                :class="['btn-generate', { 'btn-disabled': loadingApiKey || cooldownApiKey }]"
                @click="openRegenForm()"
              />
            </div>
          </div>
          <div v-if="keyStatus.api_key" class="key-status mt-1">
            <span v-if="keyStatus.api_key.isExpired" class="status-badge status-expired">
              <span class="material-symbols-rounded status-icon">warning</span>
              {{ $t('apiKey.expired') }} — {{ $t('apiKey.generateNewPrompt') }}
            </span>
            <span v-else-if="keyStatus.api_key.expiresAt" class="status-badge status-valid">
              {{ $t('apiKey.expiresAt') }}: {{ formatDate(keyStatus.api_key.expiresAt) }}
            </span>
            <span v-else class="status-badge status-valid">
              {{ $t('apiKey.neverExpires') }}
            </span>
          </div>
        </div>

        <!-- Expiration picker (shown when generating) -->
        <div v-if="showRegenForm" class="regen-form-card">
          <label class="label-title font-12">{{ $t('apiKey.expirationLabel') }}</label>
          <div class="expiration-options mt-2">
            <label class="radio-option" :class="{ active: expirationType === 'never' }">
              <input type="radio" value="never" v-model="expirationType" />
              <span>{{ $t('apiKey.neverExpires') }}</span>
            </label>
            <label class="radio-option" :class="{ active: expirationType === 'date' }">
              <input type="radio" value="date" v-model="expirationType" />
              <span>{{ $t('apiKey.customDate') }}</span>
            </label>
          </div>
          <div v-if="expirationType === 'date'" class="date-picker-wrapper mt-2">
            <input type="date" v-model="expirationDate" :min="minDate" class="date-input" />
          </div>
          <div class="regen-form-actions mt-3">
            <button class="btn-cancel" @click="showRegenForm = false">{{ $t('button.cancel') }}</button>
            <ButtonDefault
              :name="$t('apiKey.generate')"
              :loading="loadingApiKey"
              :class="['btn-confirm', { 'btn-disabled': expirationType === 'date' && !expirationDate }]"
              @click="handleGenerate()"
            />
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { mapState } from 'vuex';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import ToastService from '@/services/toast.service';
import ModalService from '@/services/modal.service';
import ApiKeyService from '../services/api-key.service';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';

interface KeyStatus {
  isExpired: boolean;
  expiresAt: string | null;
}

@Component({
  components: { ButtonDefault },
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class ApiKeyConfig extends Vue {
  @Prop() accountId!: number;

  currentAccount!: AccountDto;

  private readonly toastService = new ToastService();
  private readonly modalService = new ModalService();
  private readonly apiKeyService = new ApiKeyService();

  loadingApiKey = false;
  cooldownApiKey = false;
  showRegenForm = false;
  expirationType = 'date';
  expirationDate = '';
  keyStatus: { api_key: KeyStatus | null } = {
    api_key: null,
  };

  get minDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  openRegenForm() {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 90);
    this.expirationType = 'date';
    this.expirationDate = defaultDate.toISOString().split('T')[0];
    this.showRegenForm = true;
  }

  async mounted() {
    await this.loadKeyStatus();
  }

  async loadKeyStatus() {
    try {
      const status = await this.apiKeyService.getKeyStatus(this.accountId);
      this.keyStatus = { api_key: status.api_key };
    } catch (err) {
      console.error('Failed to load key status:', err);
    }
  }

  handleGenerate() {
    if (this.expirationType === 'date' && !this.expirationDate) {
      return;
    }

    const title = this.$t('apiKey.confirmTitle') as string;
    const text = this.$t('apiKey.confirmMessage') as string;

    this.modalService.confirm({
      title,
      text,
      confirmLabel: this.$t('apiKey.generate') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: () => this.requestRegeneration(),
    });
  }

  async requestRegeneration() {
    this.loadingApiKey = true;

    let expiresAt: string | null = null;
    if (this.expirationType === 'date' && this.expirationDate) {
      expiresAt = new Date(this.expirationDate + 'T23:59:59').toISOString();
    }

    try {
      await this.apiKeyService.requestRegeneration(this.accountId, 'api_key', expiresAt);
      this.toastService.show({
        type: 'success',
        text: this.$t('apiKey.emailSent') as string,
      });

      this.showRegenForm = false;
      this.cooldownApiKey = true;
      setTimeout(() => {
        this.cooldownApiKey = false;
      }, 120000);
    } catch (err: any) {
      console.error('Failed to request regeneration:', err);
    } finally {
      this.loadingApiKey = false;
    }
  }

  showNewKey(newKey: string) {
    this.loadKeyStatus();
  }

  formatDate(isoDate: string): string {
    if (!isoDate) {
      return '';
    }
    const date = new Date(isoDate);
    return date.toLocaleDateString('pt-BR');
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.message-form {
  padding: 20px;
}

.label-title {
  color: #5c5c5c;
}

.key-label {
  color: #5c5c5c;
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}

.key-display-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 12px;
}

.key-value {
  flex: 1;
  font-size: 14px;
  color: #6b7280;
  letter-spacing: 0.5px;
}

.key-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.btn-generate {
  min-width: auto !important;
}

.btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.key-status {
  padding-left: 4px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-expired {
  color: #dc2626;
  background-color: #fef2f2;
}

.status-valid {
  color: #6b7280;
  background-color: #f3f4f6;
}

.status-icon {
  font-size: 14px;
}

.regen-form-card {
  padding: 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.expiration-options {
  display: flex;
  gap: 8px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s;

  &:hover {
    border-color: #9ca3af;
  }

  &.active {
    border-color: $ds-blue;
    background-color: rgba($ds-blue, 0.05);
  }

  input[type='radio'] {
    accent-color: $ds-blue;
  }
}

.date-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  outline: none;

  &:focus {
    border-color: $ds-blue;
  }
}

.regen-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  padding: 8px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.btn-confirm {
  min-width: auto !important;
}
</style>
