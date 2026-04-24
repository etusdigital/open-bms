<template>
  <div class="view-new-tag col-12 pt-0 mt-5">
    <div class="title-edit pb-5">
      <div class="d-flex align-items-center mt-2">
        <span class="material-symbols-rounded font-16 ds-blue-color">chevron_left</span>
        <router-link
          :to="
            messageType.startsWith('transactional')
              ? transactionalPath
              : is2FA
              ? `/messages/2FA/${selectedMessageType}`
              : messagePath
          "
          class="text-600 font-14"
        >
          {{ $t('sidebar.messages') }}
        </router-link>
      </div>
      <span v-if="messageId" class="c-title m-0 text-600 font-24">
        {{
          $t('title.editTypeMessage', {
            type: `${
              selectedMessageType === 'mobile-push'
                ? selectedMessageType.replace('-', ' ')
                : selectedMessageType
                    .replace(/^transactional-/, '')
                    .replace(/^web-/, '')
                    .replace(/^2FA-/, '')
            }`,
          })
        }}
      </span>
      <span v-else class="c-title m-0 text-600 font-24">
        {{
          $t('button.newTypeMessage', {
            type: `${
              selectedMessageType === 'mobile-push'
                ? selectedMessageType.replace('-', ' ')
                : selectedMessageType
                    .replace(/^transactional-/, '')
                    .replace(/^web-/, '')
                    .replace(/^2FA-/, '')
            }`,
          })
        }}
      </span>
    </div>
    <AlertComponent v-if="currentMessage.status && messageId" :type="alertType(currentMessage.status)">{{
      $t(`alert.${currentMessage.status}`)
    }}</AlertComponent>
    <AlertComponent type="info" class="font-12" v-if="isMessageInUse">
      <span v-if="currentMessage.campaignInUse"
        >{{ $t('warning.messageInUse', { campaign: `{ ${currentMessage.campaignInUse.title} }` }) }}
      </span>
      <button class="text-lowercase text-600 click-button hover-copy" @click="doCopy()">
        <span>{{ $t('warning.click') }}.</span>
      </button>
    </AlertComponent>
    <span class="font-16 text-600 ds-gray-color">{{ $t('title.details') }}</span>
    <v-card class="div-column card-name-desc mb-5 mt-2 gap-10">
      <div class="div-column">
        <InputDefault
          data-cy="custom-field-new-title"
          autofocus
          max="40"
          :name="`${$t('title.name')}`"
          :modelValue="messageTitle"
          :placeholder="`${$t('input.fieldName')}`"
          :keyInput="'title'"
          :disabled="isMessageInUse"
          @updateInput="updateInput"
        />
        <span v-if="isNotAvailable" class="text-400 font-12 text-error message-alert">
          {{
            $t('alert.messageExist', {
              type: $t(
                `title.${selectedMessageType
                  .replace(/^transactional-/, '')
                  .replace(/^web-/, '')
                  .replace(/^2FA-/, '')}`
              ),
            })
          }}
        </span>
      </div>
      <InputDefault
        data-cy="custom-field-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="messageDescription"
        :placeholder="`${$t('input.fieldDescription')}`"
        :keyInput="'description'"
        :disabled="isMessageInUse"
        @updateInput="updateInput"
      />
      <LabelSelectComponent :labelContent="currentMessageLabelContent" @selectLabels="selectLabels" />
    </v-card>
    <span class="font-16 text-600 ds-gray-color">{{ $t('title.messageType') }}</span>
    <div class="fields-cards-wrapper">
      <div class="div-row justify-space-between mt-2 mb-5 fields-cards-specs gap-20">
        <button
          v-for="(card, index) in messageCards"
          :key="card.type"
          @click="selectCard(index)"
          :disabled="!checkAccountSettings(card)"
          class="fields-cards div-row"
          :class="{
            'border-blue': index === selectedCardIndex,
            'card-disabled': messageId || !checkAccountSettings(card),
          }"
          v-tooltip.top="!checkAccountSettings(card) && `${$t(`title.noAccess`)}`"
        >
          <img
            class="icon-whatsapp"
            v-if="card.type === 'whatsapp'"
            :src="
              index === selectedCardIndex ? require('@/assets/whatsapp-blue.svg') : require('@/assets/whatsapp.svg')
            "
          />
          <span
            v-else
            class="material-symbols-rounded font-36"
            :class="[index === selectedCardIndex ? 'ds-blue-color' : 'ds-gray-color']"
            >{{ card.icon }}
          </span>
          <span class="font-14 text-600" :class="[index === selectedCardIndex ? 'ds-blue-color' : 'ds-gray-color']">
            {{ card.title }}
          </span>
        </button>
      </div>
    </div>
    <span class="font-16 ds-gray-color text-600">{{ $t('create.content') }}</span>
    <WriteEmail
      v-if="selectedMessageType === 'email'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageDescription="messageDescription"
      :messageType="messageType"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
    <WritePushMessage
      v-if="selectedMessageType === 'web-push'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageDescription="messageDescription"
      :messageType="messageType"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
    <WriteMobilePushMessage
      v-if="selectedMessageType === 'mobile-push'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageDescription="messageDescription"
      :messageType="messageType"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
    <WriteSmsMessage
      v-if="selectedMessageType === 'sms'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageType="messageType"
      :messageDescription="messageDescription"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
    <WriteWhatsappMessageTwilio
      v-if="selectedMessageType === 'whatsapp' && whatsappProvider === 'twilio'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageDescription="messageDescription"
      :messageType="messageType"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
    <WriteWhatsappMessageEvolution
      v-if="selectedMessageType === 'whatsapp' && whatsappProvider === 'evolution'"
      :messageValue="currentMessage"
      :messageTitle="messageTitle"
      :messageDescription="messageDescription"
      :messageType="messageType"
      :isMessageInUse="isMessageInUse"
      :messageLabels="messageLabels"
    />
  </div>
</template>
<script script lang="ts">
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { MessageDto } from '../dtos/message.dto';
import WriteEmail from './WriteEmail.vue';
import WritePushMessage from './WritePushMessage.vue';
import WriteSmsMessage from './WriteSmsMessage.vue';
import WriteWhatsappMessageEvolution from './WriteWhatsappMessageEvolution.vue';
import WriteWhatsappMessageTwilio from './WriteWhatsappMessageTwilio.vue';
import MessagesService from '../services/messages.service';
import { debounce } from '@/util/debounce';
import AlertComponent from '@/components/alert/AlertComponent.vue';
import { MessageStatus } from '../enums/message.enum';
import LoadingService from '@/services/loading.service';
import WriteMobilePushMessage from './WriteMobilePushMessage.vue';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { getAccountConfig } from '@/store';
import { LabelDto } from '@/modules/labels/dtos/label.dto';
import LabelSelectComponent from '@/modules/labels/components/LabelSelectComponent.vue';

@Component({
  components: {
    InputDefault,
    ButtonDefault,
    WriteEmail,
    WritePushMessage,
    WriteSmsMessage,
    WriteWhatsappMessageEvolution,
    WriteWhatsappMessageTwilio,
    WriteMobilePushMessage,
    AlertComponent,
    LabelSelectComponent,
  },
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class MessageCreate extends Vue {
  private readonly messagesService = new MessagesService();
  private readonly loadingService = new LoadingService();
  public currentMessage: MessageDto = {} as MessageDto;
  public whatsappProvider = process.env.VUE_APP_WHATSAPP_PROVIDER;

  currentAccount!: AccountDto;
  selectedCardIndex = 0;
  selectedMessageType = '';
  messageTitle = '';
  messageDescription = '';
  messageLabels: LabelDto[] = [];
  messageId = 0;
  messagePath = '';

  get currentMessageLabelContent() {
    return this.currentMessage.labelContent || [];
  }
  messageType = '';
  transactionalPath = '/automations/transactional';
  isNotAvailable = false;
  isMessageInUse = false;

  messageCards = [
    {
      title: this.$t('title.email'),
      icon: 'mail',
      type: 'email',
      path: '/messages/email',
    },
    {
      title: this.$t('title.web-push'),
      icon: 'computer',
      type: 'web-push',
      path: '/messages/web-push',
    },
    {
      title: this.$t('title.mobile-push'),
      icon: 'smartphone',
      type: 'mobile-push',
      path: '/messages/mobile-push',
    },
    {
      title: 'SMS',
      icon: 'sms',
      type: 'sms',
      path: '/messages/sms',
    },
    {
      title: 'Whatsapp',
      icon: 'whatsapp',
      type: 'whatsapp',
      path: '/messages/whatsapp',
    },
  ];

  debouncedValidateName = debounce(() => this.validateMessageName(), 300);

  get is2FA() {
    return this.$route.path.includes('/2FA/');
  }

  async beforeMount() {
    if (this.$route.params.message_id) {
      this.messageId = parseInt(this.$route.params.message_id, 10);
      this.currentMessage = await this.getMessage(this.messageId);
      this.messageTitle = this.currentMessage.title || '';
      this.messageDescription = this.currentMessage.description || '';
      this.messageType = (this.currentMessage.type as string) || '';
      this.selectedMessageType = this.currentMessage.type as string;

      if (this.currentMessage.labelContent && this.currentMessage.labelContent.length > 0) {
        this.messageLabels = this.currentMessage.labelContent.map((content) => content.label);
      }

      if (this.currentMessage.campaignInUse && Object.keys(this.currentMessage.campaignInUse).length > 0) {
        this.isMessageInUse = true;
      }

      if ((this.currentMessage.type as string).startsWith('2FA-')) {
        const messageTypes = (this.currentMessage.type as string).replace(/^2FA-/, '');
        this.selectedMessageType = messageTypes;
      }

      if ((this.currentMessage.type as string).startsWith('transactional')) {
        const messageTypes = (this.currentMessage.type as string).replace(/^transactional-/, '');
        this.selectedMessageType = messageTypes;
      }
    }
    if (!this.$route.params.message_id) {
      if (this.$route.params.type) {
        this.selectedMessageType = this.$route.params.type;
        this.messageType = this.selectedMessageType;
      }

      if (this.is2FA) {
        const pathParts = this.$route.path.split('/');
        const typeIndex = pathParts.indexOf('2FA') + 1;
        if (typeIndex < pathParts.length) {
          this.selectedMessageType = pathParts[typeIndex];
          this.messageType = `2FA-${this.selectedMessageType}`;
        }
      }

      if (this.$route.query.type === 'transactional') {
        this.messageType = `${this.$route.query.type}-${this.selectedMessageType}`;
      }
    }
    this.selectedCardIndex = this.messageCards.findIndex((value: any) => value.type === this.selectedMessageType);
    this.messagePath = this.messageCards.find((value: any) => value.type === this.selectedMessageType)?.path || '';
  }

  updateInput(event: never, keyInput: never) {
    if (keyInput === 'title') {
      this.messageTitle = event;
      this.debouncedValidateName();
    } else if (keyInput === 'description') {
      this.messageDescription = event;
    }
  }

  selectCard(index: number) {
    if (!this.messageId) {
      this.selectedMessageType = this.messageCards[index].type;
      this.selectedCardIndex = index;
      this.messagePath = this.messageCards[index].path;

      if (this.is2FA) {
        this.messageType = `2FA-${this.selectedMessageType}`;
        this.$router.push({
          path: `/messages/2FA/${this.selectedMessageType}/new`,
        });
      } else if (this.$route.query.type === 'transactional') {
        this.messageType = `${this.$route.query.type}-${this.selectedMessageType}`;
        this.$router.push({
          path: `/messages/${this.selectedMessageType}/new`,
          query: { type: this.$route.query.type },
        });
      } else {
        this.messageType = this.selectedMessageType;
        this.$router.push({
          path: `/messages/${this.selectedMessageType}/new`,
        });
      }
      this.debouncedValidateName();
    }
  }

  async validateMessageName() {
    try {
      if (this.messageTitle === undefined || this.messageTitle.length < 3) {
        return;
      }

      const { data } = await this.messagesService.checkAvailableName(
        this.messageTitle || '',
        this.messageId,
        this.messageType
      );

      if (!data || data.length === 0) {
        this.isNotAvailable = false;
      } else {
        this.isNotAvailable = true;
      }
    } catch (error) {
      console.error('Error checking message title:', error);
      return false;
    }
  }

  alertType(status: string) {
    switch (status) {
      case MessageStatus.DRAFT:
        return 'warning';
      case MessageStatus.APPROVED:
        return 'success';
      case MessageStatus.REJECTED:
        return 'error';
      case MessageStatus.SEND_APPROVAL:
        return 'info';
      case MessageStatus.SENT_APPROVAL:
        return 'info';
      default:
        return '';
    }
  }

  async getMessage(messageId: number) {
    const reponse = await this.messagesService.getMessageById(messageId);
    return reponse.data;
  }

  async doCopy() {
    if (this.messageId) {
      this.isMessageInUse = false;
      const response = await this.messagesService.createMessageCopy(this.messageId);

      if (response && response.data && response.data.id) {
        this.messageId = response.data.id;
        this.$router.push(`${this.messageId}`);
        this.currentMessage = await this.getMessage(this.messageId);
        this.messageTitle = this.currentMessage?.title as string;
      }
    }
  }

  checkAccountSettings(card: any) {
    if (this.is2FA && !['email', 'sms'].includes(card.type)) {
      return false;
    }

    const settingsName = `${card.type.replace('-', '')}_settings`;
    const settingsCheck = JSON.parse(getAccountConfig(this.currentAccount, settingsName)) || {};
    return settingsCheck.isActive;
  }

  selectLabels(labels: LabelDto[]) {
    this.messageLabels = labels;
  }

  @Watch('messageType')
  checkType() {
    if (!this.messageId) {
      this.currentMessage = {};
    }
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.card-name-desc {
  padding: 20px;
  border-radius: 16px;
}

.config-card {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.fields-cards {
  width: 100%;
  height: 76px;
  padding: 20px 16px;
  align-items: center;
  border-radius: 16px;
  gap: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  border: 1px solid #d9d9d9;
  background: #ffffff;
}

.border-blue {
  border: 1px solid $ds-blue !important;
  background: #f4f8ff !important;
  opacity: 1 !important;
}

.select-card {
  white-space: nowrap;
}

.fields-cards-wrapper {
  container-type: inline-size;
  container-name: fields-cards-specs;
}

.fields-cards-specs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

input[type='radio'] {
  accent-color: $ds-blue;
}

.label-settings {
  margin-top: -2px;
}

.text-error {
  color: $ds-red;
}

.message-alert {
  text-transform: lowercase;
  &::first-letter {
    text-transform: capitalize;
  }
}

@container fields-cards-specs (max-width: 1000px) {
  .fields-cards-specs {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}
::v-deep.view-new-tag {
  width: 100%;
}
.card-disabled {
  background-color: #e9e9e900;
  border: 2px solid #d9d9d9;
  opacity: 0.5;
}
.icon-whatsapp {
  height: 36px;
  width: 36px;
}
</style>
