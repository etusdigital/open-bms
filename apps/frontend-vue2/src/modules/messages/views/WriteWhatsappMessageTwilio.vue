<template>
  <div>
    <v-card class="background-card message-form mt-2">
      <div class="wpp-column">
        <div>
          <label class="label-title font-12">{{ $t('datatable.contentType') }}</label>
          <v-select
            v-model="selectTest"
            class="type-select"
            :items="messageContentType"
            item-text="label"
            item-value="value"
            solo
            :disabled="isMessageInUse"
          ></v-select>
          <label class="label-title font-12 mt-5">{{ $t('create.messageText') }}</label>
          <div class="text-area-container div-row">
            <textarea
              class="text-content"
              :placeholder="`${$t('input.messageContent')}`"
              id="content"
              name="content"
              rows="3"
              autofocus
              v-model="localMessageValue.content"
              :keyInput="'content'"
              :disabled="isMessageInUse"
            ></textarea>
            <span
              class="material-symbols-rounded top-right unfilled-icon font-24 cursor-pointer"
              @click="toggleEmojiContent"
              >sentiment_satisfied</span
            >
            <div class="emoji-box emoji-picker">
              <VEmojiPicker
                v-show="showEmojiContent"
                :style="{ width: '380px', height: '200' }"
                labelSearch="Search"
                lang="pt-BR"
                @select="onSelectEmojiPreview($event)"
              />
            </div>
          </div>
          <div v-if="localMessageValue.whatsappType === 'call-to-action'" class="mt-5">
            <InputDefault
              :name="`${$t('create.buttonText')}`"
              autofocus
              :modelValue="localMessageValue.callToActionText"
              :placeholder="`${$t('input.buttonText')}`"
              @updateInput="updateInput"
              :keyInput="'callToActionText'"
              :disabled="isMessageInUse"
            />
          </div>
          <div v-if="localMessageValue.whatsappType === 'call-to-action'" class="mt-5">
            <InputDefault
              :name="`${$t('create.buttonURL')}`"
              autofocus
              :modelValue="localMessageValue.url"
              :placeholder="`${$t('input.buttonURL')}`"
              @updateInput="updateInput"
              :keyInput="'url'"
              :disabled="isMessageInUse"
            />
          </div>
        </div>
      </div>
      <div class="wpp-column">
        <div class="wpp-column">
          <label class="label-title font-12 mb-2">{{ $t('title.messagePreview') }}</label>
          <div class="preview-wpp mt-1">
            <div class="wpp-column">
              <img src="@/assets/whatsapp-header.png" class="wpp-header mt-1" alt="WhatsApp layout" />
              <div class="wpp-wrapper">
                <div class="wpp-text">
                  <p
                    class="text-color-content pb-2 pr-5"
                    v-if="localMessageValue.content === '' || localMessageValue.content === undefined"
                  >
                    {{ $t('create.messageContent') }}
                  </p>
                  <p class="text-color-content pb-2 pr-5" v-else>{{ localMessageValue.content }}</p>
                  <span class="time">
                    5:44 PM <span class="material-symbols-rounded font-16 mb-1"> check_circle </span>
                  </span>
                </div>
                <div class="wpp-link" v-if="localMessageValue.whatsappType === 'call-to-action'">
                  <p
                    class="text-link"
                    v-if="localMessageValue.callToActionText === '' || localMessageValue.callToActionText === null"
                  >
                    Link
                  </p>
                  <p class="text-link" v-else>{{ localMessageValue.callToActionText }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <div v-if="localMessageValue.id && localMessageValue.status !== statusEnum.DRAFT">
      <router-link class="return-button" to="/messages/whatsapp">{{ $t('button.return') }}</router-link>
    </div>
    <div v-else class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="
          messageType.startsWith('transactional')
            ? $router.push('/automations/transactional')
            : messageType.startsWith('2FA-whatsapp')
            ? currentGroup
              ? $router.push(`/messages/2FA/whatsapp/${currentGroup}`)
              : $router.push('/messages/2FA/whatsapp')
            : $router.push('/messages/whatsapp')
        "
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="localMessageValue.id ? `${$t('button.save')}` : `${$t('button.create')}`"
        @click="handleSave"
        :loading="savingMessage"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right button-outlined"
        :disabled="savingMessage || isMessageInUse"
      />
      <ButtonDefault
        :name="localMessageValue.id ? `${$t('button.sendApproval')}` : `${$t('button.createSendApproval')}`"
        @click="handleCreateAndSend"
        :loading="savingMessage"
        data-cy="automation-message-send-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
        :disabled="savingMessage || isMessageInUse"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '../dtos/message.dto';
import ToastService from '@/services/toast.service';
import MessagesService from '../services/messages.service';
import LoadingService from '@/services/loading.service';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { MessageStatus } from '../enums/message.enum';
import { VEmojiPicker } from 'v-emoji-picker';
import { getTwoFaCurrentGroup, setTwoFaConfig, getTwoFaConfig } from '@/util/objects';
import { LabelDto } from '@/modules/labels/dtos/label.dto';

@Component({
  components: { InputDefault, ButtonDefault, VEmojiPicker },
  providers: [MessagesService, LoadingService],
  computed: {
    ...mapState(['currentAccount']),
  },
  props: ['messageValue', 'messageTitle', 'messageDescription', 'messageType', 'isMessageInUse', 'messageLabels'],
})
export default class WriteWhatsappMessage extends Vue {
  @Prop() messageValue!: any;
  @Prop() messageTitle!: string;
  @Prop() messageDescription!: string;
  @Prop() messageType!: any;
  @Prop() isMessageInUse!: boolean;
  @Prop() messageLabels!: LabelDto[];

  private readonly messagesService = new MessagesService();
  private readonly toastService = new ToastService();
  private readonly loadingService = new LoadingService();
  public currentAccount!: AccountDto;

  messageId = 0;
  savingMessage = false;
  statusEnum = MessageStatus;
  messageContentType = [
    { label: this.$t('title.text'), value: 'text' },
    { label: 'Call to Action', value: 'call-to-action' },
  ];
  isNotAvailable = false;
  selectTest = '';
  localMessageValue: MessageDto = {};
  showEmojiContent = false;

  get currentGroup() {
    return getTwoFaCurrentGroup();
  }

  async beforeMount() {
    if (this.$route.params.message_id) {
      this.localMessageValue = this.messageValue;
    } else {
      this.localMessageValue.whatsappType = 'text';
      this.localMessageValue.callToActionText = null;
    }
    this.selectTest = this.localMessageValue.whatsappType ? this.localMessageValue.whatsappType : 'text';
  }

  mounted() {
    document.addEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  beforeDestroy() {
    document.removeEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  closeEmojiPickerIfClickedOutside(event: MouseEvent) {
    const contentPicker = this.$el.querySelector('.emoji-box .emoji-picker');
    const contentButton = this.$el.querySelector('.material-symbols-rounded.top-right');

    if (event.target !== contentPicker && event.target !== contentButton) {
      this.showEmojiContent = false;
    }
  }

  redirectPage() {
    window.location.href = this.localMessageValue.url;
  }

  updateInput(event: any, keyInput: keyof MessageDto) {
    this.localMessageValue[keyInput] = event;
  }

  async createMessage(status: MessageStatus) {
    this.savingMessage = true;
    try {
      this.loadingService.show();
      let response: any;

      this.localMessageValue.title = this.messageTitle;
      this.localMessageValue.description = this.messageDescription;
      this.localMessageValue.type = this.messageType;
      this.localMessageValue.status = status;
      this.localMessageValue.labels = this.messageLabels;
      if (this.localMessageValue.id) {
        delete this.localMessageValue.automationMessageAccount;
        response = await this.messagesService.updateMessage(this.localMessageValue);
      } else {
        response = await this.messagesService.createMessage(this.localMessageValue);
      }

      this.loadingService.hide();
      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.success') as string,
        });

        if (this.messageType.startsWith('2FA')) {
          const messageType = this.messageType.replace('2FA-', '');

          if (this.currentGroup) {
            const tempConfigs = getTwoFaConfig(messageType, {});

            if (!tempConfigs[this.currentGroup]) {
              tempConfigs[this.currentGroup] = [];
            }

            const newConfig = {
              message: {
                id: response.data.id,
                title: response.data.title,
                subject: response.data.subject || null,
                fromName: response.data.fromName || null,
                url: response.data.url || null,
              },
              percentage: 0,
            };

            tempConfigs[this.currentGroup].push(newConfig);
            setTwoFaConfig(messageType, tempConfigs);

            this.$router.push(`/messages/2FA/${messageType}/${this.currentGroup}`);
          } else {
            this.$router.push(`/messages/2FA/${messageType}`);
          }
          return;
        } else if (this.messageType.startsWith('transactional')) {
          this.$router.push(`/automations/transactional`);
        } else {
          this.$router.push(`/messages/whatsapp`);
        }
      }
    } catch (error) {
      this.savingMessage = false;

      this.toastService.show({
        type: 'error',
        text: this.$t('toast.error') as string,
      });

      if (this.localMessageValue.status === MessageStatus.DRAFT) {
        this.localMessageValue.status = undefined;
        return;
      }
      this.localMessageValue.status = MessageStatus.DRAFT;
    }
  }

  async handleSave() {
    await this.createMessage(MessageStatus.DRAFT);
  }

  async handleCreateAndSend() {
    await this.createMessage(MessageStatus.SEND_APPROVAL);
  }

  toggleEmojiContent() {
    this.showEmojiContent = !this.showEmojiContent;
  }

  onSelectEmojiPreview(emoji: any) {
    const value = `${this.localMessageValue.content || ''}${emoji.data}`;
    this.localMessageValue.content = value;
    this.toggleEmojiContent();
  }

  @Watch('selectTest')
  checkType(type: string) {
    this.localMessageValue.whatsappType = type;
    if (this.localMessageValue.whatsappType === 'text') {
      delete this.localMessageValue['url'];
      delete this.localMessageValue['callToActionText'];
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.hover-copy:hover {
  text-decoration: underline;
}

::v-deep
  .theme--light.v-text-field--outlined:not(.v-input--is-focused).v-input--is-disabled
  > .v-input__control
  > .v-input__slot
  fieldset {
  background-color: $ds-gray-100 !important;
  border: unset !important;
}
.form-control:disabled {
  background-color: $ds-gray-100 !important;
  border: unset !important;
  color: #a6a6a6;
}
.message-form {
  display: flex;
  flex-direction: row;
  gap: 20px;
}
.wpp-column {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.preview-wpp .wpp-column ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}
.preview-wpp .wpp-column .message-form ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}
.text-content {
  border: 1px solid #d9d9d9d9;
  border-radius: 8px;
  font-weight: 400;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 12px;
  padding-right: 12px;
  font-size: 12px;
  width: 100%;
  min-height: 36px;
}
textarea:focus {
  outline: none !important;
  border: 1px solid $ds-blue;
}
.text-content input {
  cursor: pointer;
}
.type-select {
  font-size: 12px;
}
::v-deep.v-input {
  border: $ds-gray-300 1px solid;
  border-radius: 8px;
  box-shadow: none;
  height: 32px;
}
.preview-wpp {
  box-shadow: 0px 1px 2px rgb(0 0 0 / 6%), 0px 1px 3px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: row;
  border: $ds-gray-300 4px solid;
  border-radius: 12px;
}
.wpp-wrapper {
  background-color: $ds-gray-100;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  padding-bottom: 10px;
}
.wpp-text {
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  border-radius: 0px 8px 8px 8px;
  max-width: 60%;
  margin: 20px 0 0 12px;
  padding: 8px 0 0 12px;
}
.time {
  color: #8c8c8c;
  font-size: 11px;
  align-self: flex-end;
  margin-right: 4px;
}
.wpp-link {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 60%;
  margin: 2px 0 130px 12px;
  padding: 7px 0;
}
.text-link {
  color: #35b7f1;
  font-size: 14px;
  padding: 1px 0;
  margin-bottom: 0 !important;
  max-width: 60%;
}
.text-color-content {
  margin: 0px !important;
  font-size: 16px;
  overflow: hidden;
  color: #282828;
  max-width: 60%;
}
.button-outlined {
  border: $ds-blue 2px solid !important;
  color: $ds-blue !important;
  background-color: $ds-gray-100 !important;
  padding: 8px 30px !important;

  &:hover {
    background: $ds-blue !important;
    color: #ffffff !important;
  }
}
.return-button {
  color: $ds-blue;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
}

.text-error {
  color: $ds-red;
}

.text-area-container {
  position: relative;
}
.top-right {
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px;
  margin: 1px;
  color: $ds-gray-400;
  &:hover {
    background-color: $ds-gray-100;
    border-radius: 50%;
  }
}

.text-area-content {
  position: relative;
  border: 1px solid #d9d9d9d9;
  border-radius: 8px;
  font-weight: 400;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 12px;
  padding-right: 12px;
  font-size: 12px;
  width: 100%;
  min-height: 170px;
  margin-bottom: 1em;
}

.emoji-box {
  z-index: 9;
  position: absolute;
  float: right;
}
.emoji-picker {
  left: 100.3%;
}
</style>
