<template>
  <div>
    <v-card class="background-card message-form mt-2">
      <div class="sms-column">
        <div class="div-row justify-space-between mb-1">
          <div class="div-row gap-5 align-items-center">
            <label class="label-title font-12 mb-1 label-color">{{ $t('create.message') }}</label>
            <div
              class="div-tooltip-img"
              v-tooltip.right="{
                content: smsSizeMessage,
                html: true,
                interactive: true,
                delay: { show: 0, hide: 1500 },
              }"
            >
              <span class="material-symbols-rounded ds-blue-color font-14">info</span>
            </div>
          </div>
          <span class="counter" ref="counter">{{ characterCounter() }}</span>
        </div>
        <div class="text-area-container div-row">
          <textarea
            class="text-content"
            :placeholder="`${$t('input.smsMessageContent')}`"
            ref="content"
            name="content"
            rows="3"
            autofocus
            v-model="localMessageValue.content"
            input="updateInput"
            :oninput="updateLocalMessageUrl()"
            :keyInput="'content'"
            :disabled="isMessageInUse"
          >
          </textarea>
          <span class="material-symbols-rounded top-right font-24 cursor-pointer" @click="toggleEmojiContent"
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
        <div v-if="hasSpecialCharacters()" class="sms-size-warning" ref="smsSizeWarning">
          <span class="material-symbols-rounded">info</span>
          <div v-html="smsSpecialCharactersMessage"></div>
        </div>
      </div>
      <div class="sms-column sms-preview">
        <div class="sms-column">
          <label class="label-title font-12 mb-1 label-color">{{ $t('title.messagePreview') }}</label>
          <div class="preview-sms mt-1">
            <div class="sms-column">
              <div class="sms-header">
                <img class="sms-header-img" src="@/assets/back-arrow-sms.png" />
                <p class="sms-header-text">{{ currentAccount.name }}</p>
              </div>
              <div class="sms-main">
                <p class="sms-time">
                  {{ $t('input.today') }}, {{ new Date().getHours().toString().padStart(2, '0') }}:{{
                    new Date().getMinutes().toString().padStart(2, '0')
                  }}
                </p>
                <div class="sms-message">
                  <p
                    class="text-color-content"
                    v-if="localMessageValue.content === '' || localMessageValue.content === undefined"
                  >
                    {{ $t('create.messageContent') }}
                  </p>
                  <p class="text-color-content" v-else>{{ localMessageValue.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="
          messageType.startsWith('transactional')
            ? $router.push('/automations/transactional')
            : messageType.startsWith('2FA-sms')
            ? currentGroup
              ? $router.push(`/messages/2FA/sms/${currentGroup}`)
              : $router.push('/messages/2FA/sms')
            : $router.push('/messages/sms')
        "
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="localMessageValue.id ? $t('button.save') : $t('button.create')"
        @click="buttonSave"
        :loading="savingMessage"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
        :disabled="savingMessage || isMessageInUse"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '../dtos/message.dto';
import ToastService from '@/services/toast.service';
import MessagesService from '../services/messages.service';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import DOMPurify from 'dompurify';
import { gsm7Characters, gsm7CharactersExtended } from '@/util/characters';
import { VEmojiPicker } from 'v-emoji-picker';
import { setTwoFaConfig, getTwoFaConfig, getTwoFaCurrentGroup } from '@/util/objects';
import { LabelDto } from '@/modules/labels/dtos/label.dto';

@Component({
  components: { InputDefault, ButtonDefault, VEmojiPicker },
  providers: [MessagesService, LoadingService],
  computed: {
    ...mapState(['currentAccount']),
  },
  props: ['messageValue', 'messageTitle', 'messageDescription', 'messageType', 'isMessageInUse', 'messageLabels'],
})
export default class WriteSmsMessage extends Vue {
  @Prop() messageValue!: any;
  @Prop() messageTitle!: string;
  @Prop() messageDescription!: string;
  @Prop() messageType!: any;
  @Prop() isMessageInUse!: boolean;
  @Prop() messageLabels!: LabelDto[];

  private readonly messagesService = new MessagesService();
  private readonly toastService = new ToastService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();
  public currentAccount!: AccountDto;

  messageId = 0;
  savingMessage = false;
  GSM7_CHARACTER_SIZE_BITS = 7;
  UCS_CHARACTER_SIZE_BITS = 16;
  MAX_SIZE_MESSAGE_BITS = 1120;
  SHORTCODE = '######';
  isNotAvailable = false;
  localMessageValue: MessageDto = {};
  shortlinkBaseUrl = '';
  gsm7Characters = gsm7Characters;
  gsm7CharactersExtended = gsm7CharactersExtended;
  showEmojiContent = false;

  get currentGroup() {
    return getTwoFaCurrentGroup();
  }

  async beforeMount() {
    if (this.$route.params.message_id) {
      this.localMessageValue = this.messageValue;
      this.localMessageValue.content = `${this.localMessageValue.content} ${this.localMessageValue.url}`;
    }
    this.currentAccount.accountConfigs.forEach((element: any) => {
      if (element.name === 'shortlink_base_url') {
        this.shortlinkBaseUrl = element.value;
      }
    });
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

  updateLocalMessageUrl() {
    const message = this.localMessageValue.content || '';
    const urls = this.findUrls(message);
    if (urls.length === 1) {
      this.localMessageValue.url = urls[0];
      return;
    }
    if (urls.length > 1) {
      this.localMessageValue.url = '';
    }
  }

  get smsSpecialCharactersMessage(): string | undefined {
    const message = this.$t('warning.smsSpecialCharacters', {
      charactersLimit: this.contentCharactersLimit,
    }) as string;

    return DOMPurify.sanitize(message);
  }

  get smsSizeMessage(): any {
    const message = this.$t('toast.smsCounter', {
      charactersLimit: this.contentCharactersLimit,
    }) as string;

    return DOMPurify.sanitize(message);
  }

  findUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[\w.-]+(?:\.[\w\.-]+)+(?:\/[\w\-._~:\/?#[\]@!$&'()*+,;=]*)?/g;
    const urls = text.match(urlPattern);
    return urls || [];
  }

  get localMessageWithUrlsReplacedByShortlinkUrl() {
    const urls = this.findUrls(this.localMessageValue.content ?? '');
    let message = this.localMessageValue.content ?? '';
    urls.forEach((url) => {
      message = message.replace(url, `${this.shortlinkBaseUrl}${this.SHORTCODE}`);
    });
    return message;
  }

  get maxSizeMessageBits(): number {
    if (this.messageDontHaveOnlyGsm7Characters()) {
      return this.countSegments(this.MAX_SIZE_MESSAGE_BITS) > 1
        ? this.MAX_SIZE_MESSAGE_BITS - this.UCS_CHARACTER_SIZE_BITS * 4
        : this.MAX_SIZE_MESSAGE_BITS;
    } else {
      return this.countSegments(this.MAX_SIZE_MESSAGE_BITS) > 1
        ? this.MAX_SIZE_MESSAGE_BITS - this.GSM7_CHARACTER_SIZE_BITS * 7
        : this.MAX_SIZE_MESSAGE_BITS;
    }
  }

  messageDontHaveOnlyGsm7Characters() {
    const valid_chars = this.gsm7Characters.concat(this.gsm7CharactersExtended);
    return this.localMessageWithUrlsReplacedByShortlinkUrl.split('').some((char) => {
      return !valid_chars.includes(char);
    });
  }

  countLocalMessageValueEmojis(): number {
    if (!this.localMessageWithUrlsReplacedByShortlinkUrl) {
      return 0;
    }
    const matches = this.localMessageWithUrlsReplacedByShortlinkUrl.match(/\p{Extended_Pictographic}/gu);
    return matches ? matches.length : 0;
  }

  countGsm7Characters() {
    return (
      this.localMessageWithUrlsReplacedByShortlinkUrl.split('').filter((char) => {
        return this.gsm7Characters.includes(char);
      }).length || 0
    );
  }

  countGsm7ExtendedCharacters() {
    return (
      this.localMessageWithUrlsReplacedByShortlinkUrl.split('').filter((char) => {
        return this.gsm7CharactersExtended.includes(char);
      }).length || 0
    );
  }

  countSegments(maxSizeMessageBits: number) {
    const gsm7CharactersCount = this.countGsm7Characters();
    const gsm7ExtendedCharactersCount = this.countGsm7ExtendedCharacters();
    const otherCharacters =
      (this.localMessageWithUrlsReplacedByShortlinkUrl.length ?? 0) -
      (gsm7CharactersCount ?? 0) -
      (gsm7ExtendedCharactersCount ?? 0);

    let messageSize: number;

    if (this.messageDontHaveOnlyGsm7Characters()) {
      messageSize =
        (gsm7CharactersCount + gsm7ExtendedCharactersCount + otherCharacters) * this.UCS_CHARACTER_SIZE_BITS;
    } else {
      messageSize =
        gsm7CharactersCount * this.GSM7_CHARACTER_SIZE_BITS +
        gsm7ExtendedCharactersCount * this.GSM7_CHARACTER_SIZE_BITS * 2;
    }

    return Math.ceil(messageSize / maxSizeMessageBits);
  }

  get contentCharactersLimit() {
    const emojis = this.countLocalMessageValueEmojis();

    const contentCharactersLimit = this.messageDontHaveOnlyGsm7Characters()
      ? Math.floor(this.maxSizeMessageBits / this.UCS_CHARACTER_SIZE_BITS) - emojis
      : Math.floor(this.maxSizeMessageBits / this.GSM7_CHARACTER_SIZE_BITS);

    return contentCharactersLimit < 35 ? 35 : contentCharactersLimit;
  }

  hasSpecialCharacters() {
    const validChars = this.gsm7Characters.concat(this.gsm7CharactersExtended);
    return this.localMessageWithUrlsReplacedByShortlinkUrl.split('').some((char) => {
      return !validChars.includes(char);
    });
  }

  characterCounter() {
    const emojis = this.countLocalMessageValueEmojis();

    const segments = this.countSegments(this.maxSizeMessageBits);
    const segmentsForCalc = segments === 0 ? 1 : segments;

    const currentLength = this.localMessageWithUrlsReplacedByShortlinkUrl.length ?? 0;

    if (this.messageDontHaveOnlyGsm7Characters()) {
      return (
        currentLength -
        emojis -
        this.contentCharactersLimit * (segmentsForCalc - 1) +
        '/' +
        this.contentCharactersLimit +
        ', SMS ' +
        segments
      );
    } else {
      return (
        currentLength +
        this.countGsm7ExtendedCharacters() -
        this.contentCharactersLimit * (segmentsForCalc - 1) +
        '/' +
        this.contentCharactersLimit +
        ', SMS ' +
        segments
      );
    }
  }

  redirectPage() {
    window.location.href = this.localMessageValue.url;
  }

  updateInput(event: any, keyInput: keyof MessageDto) {
    this.localMessageValue[keyInput] = event;
  }

  isUrlValid(urlString: string) {
    try {
      return Boolean(new URL(urlString));
    } catch (e) {
      return false;
    }
  }

  buttonSave() {
    !this.isUrlValid(this.localMessageValue.url) ? this.noLinkModal() : this.handleSaveMessage();
  }

  noLinkModal() {
    if (!this.isUrlValid(this.localMessageValue.url)) {
      return this.modalService.confirm({
        title: this.$t('modal.smsNoLink') as string,
        text: `${this.$t('modal.confirmNoLink')}`,
        confirmLabel: this.$t('button.confirm') as string,
        cancelLabel: this.$t('button.cancel') as string,
        confirmFunction: this.handleSaveMessage,
        isConfirm: true,
      });
    }
  }

  async handleSaveMessage() {
    this.savingMessage = true;

    this.localMessageValue.title = this.messageTitle;
    this.localMessageValue.description = this.messageDescription;
    this.localMessageValue.type = this.messageType;
    this.localMessageValue.labels = this.messageLabels;
    this.localMessageValue.content = this.localMessageValue.content?.replace(this.localMessageValue.url, '');
    try {
      this.loadingService.show();
      let response: any;
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
          this.$router.push(`/messages/sms`);
        }
      }
    } catch (error) {
      this.savingMessage = false;
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.error') as string,
      });
    } finally {
      this.savingMessage = false;
    }
  }
  toggleEmojiContent() {
    this.showEmojiContent = !this.showEmojiContent;
  }

  onSelectEmojiPreview(emoji: any) {
    const value = `${this.localMessageValue.content || ''}${emoji.data}`;
    this.localMessageValue.content = value;
    this.toggleEmojiContent();
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
.sms-column {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.preview-sms {
  display: flex;
  flex-direction: row;
  border: $ds-gray-300 4px solid;
  border-radius: 12px;
  box-shadow: none !important;
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
  &:hover {
    background-color: $ds-gray-100;
    border-radius: 50%;
  }
}

.emoji-box {
  z-index: 9;
  position: absolute;
  float: right;
}
.emoji-picker {
  left: 100.3%;
}

.text-content {
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
.counter-wrapper {
  display: flex;
  justify-content: space-between;
}
.counter {
  font-size: 12px;
  align-self: center;
  display: flex;
  justify-content: flex-end;
  color: black;
}
.counter.surpassed {
  color: #fcd23b;
}

textarea:focus {
  outline: none !important;
  border: 1px solid $ds-blue;
}
.text-content input {
  cursor: pointer;
}
.preview-sms {
  box-shadow: 0px 1px 2px rgb(0 0 0 / 6%), 0px 1px 3px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: row;
}
.sms-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 30px;
  width: 100% !important;
  padding: 32px 0px;
  background: white;
  border-radius: 12px;
}
.sms-header-img {
  margin-right: 38.5%;
  margin-left: 3%;
}
.sms-header-text {
  color: black !important;
  margin: 0px !important;
  font-size: 22px;
  font-weight: 600;
  text-align: center;
}
.sms-main {
  width: 100%;
  background: $ds-gray-100;
  height: max-content;
  border-bottom-left-radius: 9px;
  border-bottom-right-radius: 9px;
}
.sms-time {
  color: #919191;
  text-align: center;
  margin-top: 20px;
}
.sms-message {
  background: white;
  width: max-content;
  max-width: 70%;
  padding: 6px 10px;
  margin-left: 3%;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  margin-bottom: 3%;
}
.sms-link {
  color: $ds-blue !important;
  text-decoration: underline;
  font-size: 14px;
  word-break: break-all;
}
.sms-size-warning {
  display: flex;
  flex-direction: row;
  border: 2px solid #fcd23b;
  border-radius: 25px;
  background-color: #fffdef;
  padding: 0.3em;
  margin-bottom: 1em;
}
.sms-size-warning span {
  color: #fcd23b;
  font-size: 3.3em;
  padding-right: 0.3em;
  padding-left: 0.2em;
  margin-top: auto;
  margin-bottom: auto;
}
.sms-size-warning div {
  color: #fcd23b;
  margin-top: 0.7em;
  font-size: 13px;
}

.hide {
  display: none;
}

.text-color-content {
  color: black;
  margin: 0px !important;
  padding: 2px;
  font-size: 14px;
  overflow: hidden;
  line-height: 1.25;
  width: 100%;
}
::v-deep .v-label {
  margin-bottom: 0px !important;
}

.div-tooltip div img {
  margin-bottom: 8px;
}

.text-error {
  color: $ds-red;
}
.text-area-container .material-symbols-rounded {
  font-variation-settings: 'FILL' 0, 'wght' 700, 'GRAD' 0, 'opsz' 48;
  color: $ds-gray-400;
}

.sms-preview {
  max-width: 50%;
}
</style>
