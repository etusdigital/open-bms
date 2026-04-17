<template>
  <div class="result-test">
    <div>
      <div class="mb-4 text-center col-12">
        <h6 class="c-subtitle">
          <strong>{{ $t('title.resultTest') }}</strong>
        </h6>
      </div>

      <div class="col-12 update-results">
        <button
          v-if="!isEverythingFinished"
          class="float-right btn-update-result"
          @click="updateData()"
          :disabled="isLoading"
        >
          <i class="material-symbols-rounded font-24" v-bind:class="{ 'icon-spin': isLoading }" aria-hidden="true"
            >sync</i
          >
          <span v-if="!isLoading">{{ $t('title.updateResult') }} ({{ countDown }})</span>
          <span v-if="isLoading">{{ $t('title.updating') }}</span>
        </button>
      </div>

      <div class="d-flex">
        <div class="pr-0 pl-0 col-12 col-md-12">
          <div class="text-center glockapps-card">
            <h6 class="c-subtitle">
              <img src="@/assets/gmail-logo.svg" alt="Gmail logo" />
              {{ $t('title.generalResult') }}
            </h6>
            <div class="d-flex justify-content-center">
              <div class="mr-5">
                <p class="green-text">{{ $t('title.inbox') }}</p>
                <span>{{ gmailProviderResult.inbox | percent(0, 1) }}</span>
              </div>
              <div class="mr-5">
                <p class="orange-text">{{ $t('title.tabs') }}</p>
                <span>{{ gmailProviderResult.other | percent(0, 1) }}</span>
              </div>
              <div class="mr-5">
                <p class="red-text">{{ $t('title.spam') }}</p>
                <span>{{ gmailProviderResult.spam | percent(0, 1) }}</span>
              </div>

              <div class="mr-5">
                <p class="gray-text">{{ $t('title.missing') }}</p>
                <span>{{ gmailProviderResult.missing | percent(0, 1) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 glockapps-card">
        <h6 class="text-center c-subtitle">
          <img src="@/assets/gmail-logo.svg" alt="Gmail logo" />
          {{ $t('title.gmailResult') }} {{ mailTrigger | pipeNameColumnSenderEmailTrigger }}
        </h6>

        <v-simple-table class="c-simple-table">
          <template>
            <thead>
              <tr>
                <th scope="col" class="text-left">
                  {{ mailTrigger | pipeNameColumnSenderEmailTrigger }}
                </th>
                <th scope="col" v-if="active" class="text-left">{{ $t('title.version') }}</th>
                <th scope="col" class="text-left">{{ $t('title.provider') }}</th>
                <th scope="col" class="text-left">{{ $t('title.inbox') }}</th>
                <th scope="col" class="text-left">{{ $t('title.tabs') }}</th>
                <th scope="col" class="text-left">{{ $t('title.spam') }}</th>
                <th scope="col" class="text-left">{{ $t('title.missing') }}</th>
                <th scope="col" class="text-left">{{ $t('title.status') }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(result, index) in accountsResultByGmailProvider" :key="`result-${index}`">
                <td class="text-left">
                  <div class="rich-cell">
                    <v-checkbox v-if="active" v-model="selectedSenders" :value="result.name" class="c-checkbox">
                    </v-checkbox>

                    <a :href="result.link" rel="noopener noreferrer" class="c-link" target="_blank">
                      {{ result.name }}
                    </a>
                  </div>
                </td>
                <td v-if="active">{{ result.version }}</td>
                <td>{{ result.providers[0].provider || 'GlockApps' }}</td>
                <td>{{ result.providers[0].inbox | percent(0, 1) }}</td>
                <td>{{ result.providers[0].other | percent(0, 1) }}</td>
                <td>{{ result.providers[0].spam | percent(0, 1) }}</td>
                <td>{{ result.providers[0].missing | percent(0, 1) }}</td>
                <td>{{ result.providers[0].finished ? $t('title.finished') : $t('title.inProgress') }}</td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>

        <p v-if="accountsResultByGmailProvider.length === 0">{{ $t('datable.noData') }}</p>
        <div class="text-center">
          <button
            class="mt-5 btn btn-c btn-lg btn-success btn-success-c"
            @click="fixMessage(selectedSenders)"
            :disabled="active && mailTrigger === mailTriggerEnum.ACTIVE_CAMPAIGN && selectedSenders.length === 0"
          >
            <img src="@/assets/edit-light.svg" alt="edit icon" />
            {{ mailTrigger | pipeTextButtonSelectedEmailTriggers }}
          </button>

          <router-link :to="`/messages/email/${messageId}/deliverability-test`" replace>
            <button class="btn btn-c btn-light btn-light-c button-view-fields float-right mt-5">Novo Teste</button>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { MailTriggerEnum } from '@/enums/mail-trigger.enum';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import { GlockAppsTestResultInterface } from '@/modules/messages/interfaces/glock-apps-test-result.interface';
import { GlockAppsAccountInterface } from '@/modules/messages/interfaces/glockAppsAccount.interface';
import { GlockAppsProviderInterface } from '@/modules/messages/interfaces/glockAppsProvider.interface';
import { GlockAppsResultInterface } from '@/modules/messages/interfaces/glockAppsResult.interface';
import MessageApiService from '@/modules/messages/services/message-api.service';
import CampaignService from '@/services/campaign.service';
import { Component, Vue } from 'vue-property-decorator';

@Component({
  providers: [MessageApiService, CampaignService],
  filters: {
    pipeNameColumnSenderEmailTrigger(mailTriggerEnum: MailTriggerEnum) {
      switch (mailTriggerEnum) {
        case MailTriggerEnum.ACTIVE_CAMPAIGN:
          return 'Conta';
        case MailTriggerEnum.SENDGRID:
        case MailTriggerEnum.ONGAGE:
          return 'Silo';
        default:
          return 'Trigger não identificado';
      }
    },
    pipeTextButtonSelectedEmailTriggers(mailTriggerEnum: MailTriggerEnum) {
      switch (mailTriggerEnum) {
        case MailTriggerEnum.ACTIVE_CAMPAIGN:
          return 'Criar correção para conta(s) selecionada(s)';
        case MailTriggerEnum.ONGAGE:
        case MailTriggerEnum.SENDGRID:
          return 'Criar correção para todos os silo(s)';
        default:
          return 'Correção de trigger não identificado';
      }
    },
  },
  props: ['messages', 'mailTrigger', 'fixMessage', 'active', 'messageId'],
})
export default class ResultTest extends Vue {
  private readonly messageApiService = new MessageApiService();

  public glockAppsResultTest: GlockAppsResultInterface = {} as GlockAppsResultInterface;
  public gmailProviderResult: GlockAppsProviderInterface = {} as GlockAppsProviderInterface;
  public accountsResultByGmailProvider: GlockAppsAccountInterface[] = [];

  public selectedSenders: Array<any> = [];
  public refreshResults: null | ReturnType<typeof setInterval> = null;
  public isLoading = false;
  public countDown = 5;

  mailTriggerEnum = MailTriggerEnum;

  async mounted() {
    this.$watch('messages', this.callApiListResultGlockApps);
    this.refreshResults = setInterval(async () => {
      if (!this.isEverythingFinished) {
        await this.updateData();
      }
    }, 5000);
  }

  async startCountDown() {
    this.countDown = 5;
    const id = setInterval(() => {
      if (this.countDown === 0) {
        clearInterval(id);
      } else {
        this.countDown--;
      }
    }, 1000);
  }

  async updateData() {
    await this.callApiListResultGlockApps();
    await this.startCountDown();
  }

  async callApiListResultGlockApps() {
    this.isLoading = true;
    const senders: Array<GlockAppsTestResultInterface> = this.$props.messages
      .map((message: MessageDto) => {
        return message.accounts.map((account: any) => {
          return {
            accountId: account.accountId,
            testId: account.testId,
            version: account.version,
            provider: account.provider,
          };
        });
      })
      .flat();

    const resultGlockApps = await this.messageApiService.getGlockAppsTestResult(senders);
    this.glockAppsResultTest = resultGlockApps.data.glockApps;

    this.filterResultsByGmailProvider();
    this.filterAccountsResultsByGmailProvider();
    this.isLoading = false;
  }

  filterResultsByGmailProvider() {
    if (this.glockAppsResultTest.senders) {
      this.gmailProviderResult = this.glockAppsResultTest.providers[0];
    }
  }

  filterAccountsResultsByGmailProvider() {
    const tableResults: GlockAppsAccountInterface[] = this.glockAppsResultTest.senders ?? [];

    this.accountsResultByGmailProvider = tableResults;
  }

  get isEverythingFinished() {
    return this.accountsResultByGmailProvider.every((currentData) => currentData.providers[0].finished);
  }

  beforeDestroy() {
    if (this.refreshResults) {
      clearInterval(this.refreshResults);
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.result-test {
  width: 100%;

  .update-results {
    margin-bottom: 27px;
  }

  .c-subtitle {
    margin-bottom: 6px;
  }
}

h6 {
  font-style: normal;
  font-weight: 400;
  font-size: 20px;
  line-height: 24px;
  text-align: center;
  color: #020202;
}

p {
  text-transform: uppercase;
  font-style: normal;
  font-weight: normal;
  font-size: 16px;
  line-height: 19px;
  text-align: center;
}

.green-text {
  color: #17ac7e;
}

.orange-text {
  color: #f5802a;
}

.red-text {
  color: #fb5b73;
}

.gray-text {
  color: $neutral-gray-600;
}

.glockapps-card {
  background: #ffffff;
  border: 1px solid $neutral-gray-300;
  box-sizing: border-box;
  border-radius: 4px;
  padding: 24px;
  margin-bottom: 16px !important;
  min-height: 147px;
}

.glockapps-card span {
  font-style: normal;
  font-weight: bold;
  font-size: 24px;
  line-height: 29px;
  color: $neutral-gray-700;
  margin-top: 8px !important;
}

.c-link {
  cursor: pointer;
  text-decoration: underline !important;
  font-size: 16px;
  line-height: 20px;
  text-align: right;
  color: $neutral-gray-700 !important;
}

.c-link:hover {
  color: #17ac7e !important;
}

.subtitle img {
  margin-bottom: 5px !important;
}

.c-simple-table {
  margin-top: 20px !important;
}

.c-simple-table th {
  border-bottom: none !important;
}

.btn-update-result {
  line-height: 150% !important;
  text-transform: uppercase !important;
  color: $neutral-gray-800 !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  cursor: pointer;
}

.btn-update-result:hover {
  color: #35353ba4 !important;
}

.btn-update-result span {
  margin-left: 8px !important;
  letter-spacing: 0.07em !important;
  vertical-align: super !important;
}

.glockapps-card button img {
  margin-right: 9.33px;
  margin-bottom: 2px;
}

.rich-cell {
  display: flex;
  align-items: center;

  a {
    margin-bottom: 0 !important;
  }
}
</style>
