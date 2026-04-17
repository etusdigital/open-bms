<template>
  <div class="div-column">
    <div class="push-card div-row mt-2 mb-5">
      <div class="d-flex w-50">
        <div class="div-column gap-20 w-100">
          <div class="div-row gap-5">
            <InputDefault
              data-cy="subject"
              autofocus
              :name="`${$t('datatable.title')}`"
              :modelValue="localMessageValue.subject"
              :placeholder="`${$t('input.messageTitle')}`"
              :keyInput="'subject'"
              :disabled="isMessageInUse"
              :inputIcon="inputSubject"
              @updateInput="updateInput"
              @buttonAction="buttonAction"
            />
            <CustomSelection
              :openCustom="showSubjectCustom"
              :type="'subject'"
              @closeCustom="showSubjectCustom = false"
              @updateFields="updateFields"
            />
            <div class="emoji-input first-picker picker-padding">
              <VEmojiPicker
                v-show="showSubjectEmoji"
                class="emoji-picker-size"
                labelSearch="Search"
                lang="pt-BR"
                :disabled="isMessageInUse"
                @select="onSelectEmojiPreview($event, 'subject')"
              />
            </div>
          </div>
          <div class="div-row gap-5">
            <InputDefault
              data-cy="content"
              autofocus
              :name="`${$t('create.content')}`"
              :modelValue="localMessageValue.content"
              :placeholder="`${$t('input.messageContent')}`"
              :keyInput="'content'"
              :disabled="isMessageInUse"
              :inputIcon="inputContent"
              @updateInput="updateInput"
              @buttonAction="buttonAction"
            />
            <CustomSelection
              :openCustom="showContentCustom"
              :type="'content'"
              @closeCustom="showContentCustom = false"
              @updateFields="updateFields"
            />
            <div class="emoji-input second-picker picker-padding">
              <VEmojiPicker
                v-show="showContentEmoji"
                class="emoji-picker-size"
                labelSearch="Search"
                lang="pt-BR"
                :disabled="isMessageInUse"
                @select="onSelectEmojiPreview($event, 'content')"
              />
            </div>
          </div>
          <div>
            <InputDefault
              data-cy="url"
              autofocus
              :name="`${$t('title.redirectLink')}`"
              :modelValue="localMessageValue.url"
              :placeholder="`${$t('input.messageURL')}`"
              :keyInput="'url'"
              :disabled="isMessageInUse"
              :tooltipIcon="'info'"
              :tooltipMessage="'input.urlTooltip'"
              @updateInput="updateInput"
            />
          </div>
          <div class="div-column gap-5 ds-gray-color">
            <span class="text-600 font-12">{{ $t('title.image') }}</span>
            <div class="div-row gap-10 align-items-center">
              <input
                type="file"
                id="select-image"
                name="select-image"
                accept="image/png, image/jpeg"
                ref="inputFile"
                @change="onChangeFile"
                hidden
                :disabled="isMessageInUse"
              />
              <label
                for="select-image"
                class="select-image-button text-600 font-10 cursor-pointer mb-0"
                :disabled="isMessageInUse"
                >{{ $t('button.chooseImage') }}</label
              >
              <span class="font-12 image-name">{{ imageName }}</span>
              <span
                class="material-symbols-rounded font-24 logo-color cursor-pointer"
                v-if="imageFile !== null"
                @click="removeFile"
                >delete</span
              >
            </div>
          </div>
          <div class="div-column gap-5">
            <div class="div-row gap-5 align-items-center">
              <span class="text-600 font-12 ds-gray-color">
                {{ $t('title.notificationSound') }}
              </span>
              <span
                class="material-symbols-rounded ds-blue-color font-14 tooltip-icon"
                v-tooltip.right="$t('input.notificationSound')"
              >
                info
              </span>
            </div>
            <select
              class="select-height select-width select-border ds-gray-color border-input select-items-per-page font-12"
              v-model="selectedSound"
              :disabled="isMessageInUse"
            >
              <option v-for="sound in notificationSounds" :key="`${sound.type}-sound`" :value="sound.type">
                {{ sound.title }}
              </option>
            </select>
          </div>
          <div v-if="selectedSound === 'custom'">
            <InputDefault
              data-cy="notificationSound"
              autofocus
              :name="`${$t('title.soundName')}`"
              :modelValue="localMessageValue.notificationSound"
              :placeholder="`${$t('input.typeSound')}`"
              :keyInput="'notificationSound'"
              :disabled="isMessageInUse"
              :tooltipIcon="'info'"
              :tooltipMessage="'input.fileSoundTip'"
              @updateInput="updateInput"
            />
          </div>
          <div class="div-column gap-5">
            <div class="div-row align-items-center gap-5">
              <input
                type="checkbox"
                key="expiration-notification"
                id="expiration-notification-checkbox"
                class="create-button cursor-pointer"
                v-model="isNotificationExpiring"
                :disabled="isMessageInUse"
              />
              <label
                class="mb-0 ds-gray-color font-12 text-600 cursor-pointer"
                for="expiration-notification-checkbox"
                key="expiration-notification-label"
                :disabled="isMessageInUse"
              >
                {{ $t('title.notificationExpiration') }}
              </label>
              <span
                class="material-symbols-rounded ds-blue-color font-14 tooltip-icon"
                v-tooltip.right="$t('input.expireNotification')"
              >
                info
              </span>
            </div>
            <div v-if="isNotificationExpiring" class="div-row gap-10 font-12">
              <input
                type="number"
                class="border-input number-expire pl-2 pr-2 ds-gray-color"
                v-model="expireValue"
                :disabled="!isNotificationExpiring || isMessageInUse"
              />
              <select
                class="select-height select-width select-border ds-gray-color border-input select-items-per-page font-12"
                v-model="localMessageValue.expiryPushFilter"
                :disabled="!isNotificationExpiring || isMessageInUse"
              >
                <option
                  v-for="notification in expireNotification"
                  :key="`${notification.type}-notification`"
                  :value="notification.type"
                >
                  {{ notification.title }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div class="d-flex justify-content-center all-preview-width">
        <div class="d-flex gap-15 preview-width justify-center">
          <div class="div-column preview-height w-100 gap-5">
            <div class="div-row gap-5 align-items-center">
              <span class="text-600 font-12 ds-gray-color">{{ $t('title.preview') }}</span>
              <span
                class="material-symbols-rounded ds-blue-color font-14 tooltip-icon"
                v-tooltip.right="$t('input.previewTooltip')"
              >
                info
              </span>
            </div>
            <div class="div-column gap-5 align-items-center w-100 justify-center align-self-center">
              <span class="text-600 font-12 ds-gray-color">{{ $t('title.initial') }}</span>
              <div class="div-column initial-preview initial-height">
                <div class="div-row gap-5 preview-top mt-5 mb-5">
                  <span class="preview-speaker preview-color"></span>
                  <span class="preview-camera preview-color"></span>
                </div>
                <div class="d-flex preview-initial-screen preview-color align-items-center notification-content">
                  <div class="div-row initial-notification justify-space-between notification-content">
                    <div class="div-column gap-5 font-12 initial-preview-text">
                      <span class="text-600 ds-gray-color text-preview">
                        {{
                          checkInputEmpty(localMessageValue.subject) ? $t('datatable.title') : localMessageValue.subject
                        }}
                      </span>
                      <span class="ds-gray-color text-preview">
                        {{
                          checkInputEmpty(localMessageValue.content)
                            ? $t('datatable.message')
                            : localMessageValue.content
                        }}
                      </span>
                    </div>
                    <div class="div-row">
                      <img v-if="messageImage" :src="messageImage" class="initial-image-preview" />
                      <div v-else class="image-border d-flex align-items-center align-self-start">
                        <span class="material-symbols-rounded font-24 unfilled-icon">image</span>
                      </div>
                      <span v-if="isAndroidPreview" class="material-symbols-rounded font-24">keyboard_arrow_down</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="div-column gap-5 align-items-center pt-2 w-100 justify-center align-self-center">
              <span class="text-600 font-12 ds-gray-color">{{ $t('title.expanded') }}</span>
              <div class="div-column initial-preview expanded-height">
                <div class="div-row gap-5 preview-top mt-5 mb-5">
                  <span class="preview-speaker preview-color"></span>
                  <span class="preview-camera preview-color"></span>
                </div>
                <div class="d-flex preview-expanded-screen preview-color align-items-center notification-content">
                  <div class="d-flex initial-notification notification-content gap-5 flex-column">
                    <div class="div-row justify-space-between">
                      <div class="div-column gap-5 font-12 initial-preview-text">
                        <span class="text-600 ds-gray-color text-preview">
                          {{
                            checkInputEmpty(localMessageValue.subject)
                              ? $t('datatable.title')
                              : localMessageValue.subject
                          }}
                        </span>
                        <span class="ds-gray-color">
                          {{
                            checkInputEmpty(localMessageValue.content)
                              ? $t('datatable.message')
                              : localMessageValue.content
                          }}
                        </span>
                      </div>
                      <span v-if="isAndroidPreview" class="material-symbols-rounded font-24">keyboard_arrow_up</span>
                    </div>
                    <div class="div-row expanded-image-preview">
                      <img v-if="messageImage" :src="messageImage" class="expanded-image-preview" />
                      <div v-else class="image-border d-flex align-items-center justify-center expanded-image-preview">
                        <span class="material-symbols-rounded unfilled-icon font-36">image</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="div-row device-switch justify-space-between align-self-center">
              <span
                class="material-symbols-rounded font-24 p-2 cursor-pointer"
                :class="isAndroidPreview ? 'ds-blue-color background-selected' : 'logo-color'"
                @click="isAndroidPreview = true"
              >
                android
              </span>
              <img
                @click="isAndroidPreview = false"
                :src="isAndroidPreview ? grayAppleLogo : blueAppleLogo"
                class="cursor-pointer apple-icon"
                :class="{ 'background-selected ': !isAndroidPreview }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <span class="font-16 ds-gray-color text-600 title-spacing">{{ $t('title.sendAsTest') }}</span>
    <div class="push-card div-row mt-2 mb-5">
      <div class="test-message w-100">
        <form @submit.prevent="sendMessageTeste">
          <div class="div-row gap-15">
            <div class="div-column inputs-test">
              <label class="label-title label-color font-12 text-600 mb-1">{{ $t('create.addresseeEmail') }}</label>
              <input
                class="form-control"
                data-cy="automation-send-push-email"
                :placeholder="`${$t('input.addresseeEmail')}`"
                v-model="sendTestEmail"
              />
            </div>
            <div class="d-flex align-end flex-end">
              <ButtonDefault
                type="submit"
                class="btn btn-c btn-light btn-light-c cursor-pointer"
                :name="`${$t(isSendingTest ? 'button.sending' : 'button.sendTest')}`"
                bind:class="{isSendingTest: isSendingTest}"
                :disabled="isSendingTest"
                :loading="isSendingTest"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
    <div class="div-row footer-buttons align-items-center gap-15">
      <button
        class="cancel-button"
        @click="
          messageType.startsWith('transactional')
            ? $router.push('/automations/transactional')
            : $router.push('/messages/mobile-push')
        "
      >
        {{ $t('button.cancel') }}
      </button>
      <button
        class="d-flex create-button text-600 buttons-style ds-white-color text-uppercase align-items-center pl-7 pr-7 font-12"
        @click="buttonSave"
      >
        {{ localMessageValue.id ? $t('button.save') : $t('button.create') }}
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import MessagesService from '../services/messages.service';
import { MessageDto } from '../dtos/message.dto';
import { VEmojiPicker } from 'v-emoji-picker';
import ApiService from '@/services/api.service';
import ToastService from '@/services/toast.service';
import CustomSelection from '../components/CustomSelection.vue';
import ServicesService from '../services/services.service';
import { SendMobilePushMessageDto } from '../dtos/send-mobile-push.dto';
import { LabelDto } from '@/modules/labels/dtos/label.dto';

@Component({
  components: { InputDefault, ButtonDefault, VEmojiPicker, CustomSelection },
  providers: [MessagesService],
  props: ['messageValue', 'messageTitle', 'messageDescription', 'messageType', 'isMessageInUse', 'messageLabels'],
})
export default class WriteMobilePushMessage extends Vue {
  @Prop() messageValue!: any;
  @Prop() messageTitle!: string;
  @Prop() messageDescription!: string;
  @Prop() messageType!: any;
  @Prop() isMessageInUse!: any;
  @Prop() messageLabels!: LabelDto[];

  private readonly messagesService = new MessagesService();
  private readonly apiService = new ApiService();
  private readonly toastService = new ToastService();
  private readonly servicesService = new ServicesService();

  localMessageValue = { subject: '', content: '' } as MessageDto;
  expireNotification = [
    { type: 'day', title: this.$t('title.days') },
    { type: 'hour', title: this.$t('title.hours') },
  ];
  notificationSounds = [
    { type: 'default', title: this.$t('input.systemDefault') },
    { type: 'custom', title: this.$t('automation.custom') },
  ];
  inputSubject = [
    { icon: 'person', type: 'filled', action: 'customSubject' },
    { icon: 'sentiment_satisfied', type: 'unfilled', action: 'emojiSubject' },
  ];
  inputContent = [
    { icon: 'person', type: 'filled', action: 'customContent' },
    { icon: 'sentiment_satisfied', type: 'unfilled', action: 'emojiContent' },
  ];
  showSubjectEmoji = false;
  showContentEmoji = false;
  showSubjectCustom = false;
  showContentCustom = false;
  isNotificationExpiring = false;
  isAndroidPreview = true;
  grayAppleLogo = '';
  blueAppleLogo = '';
  isUploadImage = false;
  messageImage = '';
  imageFile: File | null = null;
  imageName = '';
  savingMessage = false;
  selectedSound = 'default';
  expireValue!: number | null;
  sendTestEmail = '';
  isSendingTest = false;

  async beforeMount() {
    this.grayAppleLogo = require('@/assets/gray-apple-logo.svg');
    this.blueAppleLogo = require('@/assets/blue-apple-logo.svg');
    if (this.$route.params.message_id) {
      this.localMessageValue = this.messageValue;
      this.messageImage = this.localMessageValue.image || '';
      this.imageName = this.getImageName(this.localMessageValue.image || '');
      this.selectedSound = this.localMessageValue.notificationSound === 'default' ? 'default' : 'custom';
      if (this.localMessageValue.expiryPushInSeconds) {
        this.isNotificationExpiring = true;
        this.expireValue =
          this.localMessageValue.expiryPushFilter === 'day'
            ? (this.localMessageValue.expiryPushInSeconds || 0) / 60 / 60 / 24
            : (this.localMessageValue.expiryPushInSeconds || 0) / 60 / 60;
      }
    }
  }

  mounted() {
    document.addEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  beforeDestroy() {
    document.removeEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  closeEmojiPickerIfClickedOutside(event: MouseEvent) {
    const subjectPicker = this.$el.querySelector('.emoji-input .first-picker');
    const contentPicker = this.$el.querySelector('.emoji-input .second-picker');
    const subjectButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.emojiSubject');
    const contentButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.emojiContent');

    if (event.target !== subjectPicker && event.target !== subjectButton) {
      this.showSubjectEmoji = false;
    }
    if (event.target !== contentPicker && event.target !== contentButton) {
      this.showContentEmoji = false;
    }
  }

  updateInput(event: any, keyInput: keyof MessageDto) {
    this.localMessageValue[keyInput] = event;
  }

  async buttonSave() {
    this.savingMessage = true;
    try {
      if (this.isUploadImage) {
        this.localMessageValue.image = await this.uploadImage();
      }

      if (this.expireValue) {
        this.localMessageValue.expiryPushInSeconds =
          this.localMessageValue.expiryPushFilter === 'day'
            ? 60 * 60 * 24 * (this.expireValue || 0)
            : (this.expireValue || 0) * 60 * 60;
      }

      if (
        this.localMessageValue.url &&
        this.isValidUrl(this.localMessageValue.url) === false &&
        this.isValidPlaceholder(this.localMessageValue.url) === false
      ) {
        this.savingMessage = false;

        if (
          this.localMessageValue.url.charAt(0) === '%' &&
          this.isValidPlaceholder(this.localMessageValue.url) === false
        ) {
          this.toastService.show({
            type: 'error',
            text: this.$t('toast.invalidPlaceholder') as string,
          });
          return;
        }

        if (this.localMessageValue.url.charAt(0) !== '%' && this.isValidUrl(this.localMessageValue.url) === false) {
          this.toastService.show({
            type: 'error',
            text: this.$t('toast.invalidURL') as string,
          });
          return;
        }

        return;
      }
      let response: any;
      this.localMessageValue.title = this.messageTitle;
      this.localMessageValue.description = this.messageDescription;
      this.localMessageValue.type = this.messageType;
      this.localMessageValue.labels = this.messageLabels;
      this.localMessageValue.notificationSound =
        this.selectedSound === 'custom' ? this.localMessageValue.notificationSound : 'default';
      if (this.localMessageValue.id) {
        delete this.localMessageValue.automationMessageAccount;
        response = await this.messagesService.updateMessage(this.localMessageValue);
      } else {
        response = await this.messagesService.createMessage(this.localMessageValue);
      }

      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.success') as string,
        });

        this.messageType.startsWith('transactional')
          ? this.$router.push('/automations/transactional')
          : this.$router.push('/messages/mobile-push');
      }
    } catch (error) {
      this.savingMessage = false;

      this.toastService.show({
        type: 'error',
        text: this.$t('toast.error') as string,
      });
    }
  }

  buttonAction(action: string) {
    switch (action) {
      case 'customSubject':
        return this.openCustomPreview('subject');
      case 'emojiSubject':
        return this.openEmojiPreview('subject');
      case 'customContent':
        return this.openCustomPreview('content');
      case 'emojiContent':
        return this.openEmojiPreview('content');
    }
  }

  openEmojiPreview(type: string) {
    if (type === 'subject') {
      this.showSubjectEmoji = !this.showSubjectEmoji;
      this.showContentEmoji = false;
    }
    if (type === 'content') {
      this.showContentEmoji = !this.showContentEmoji;
      this.showSubjectEmoji = false;
    }
  }

  openCustomPreview(type: string) {
    if (type === 'subject') {
      this.showSubjectCustom = !this.showSubjectCustom;
      this.showContentCustom = false;
    }
    if (type === 'content') {
      this.showContentCustom = !this.showContentCustom;
      this.showSubjectCustom = false;
    }
  }

  onSelectEmojiPreview(emoji: any, input: string) {
    if (input === 'subject') {
      const value = `${this.localMessageValue.subject}${emoji.data}`;
      this.localMessageValue.subject = value;
      this.openEmojiPreview('subject');
    }
    if (input === 'content') {
      const value = `${this.localMessageValue.content}${emoji.data}`;
      this.localMessageValue.content = value;
      this.openEmojiPreview('content');
    }
  }

  updateFields(type: string, fieldName: any, defaultValue: string) {
    if (type === 'subject') {
      const value = `${this.localMessageValue.subject}{{${fieldName} | ${defaultValue}}}`;
      this.localMessageValue.subject = value;
    }
    if (type === 'content') {
      const value = `${this.localMessageValue.content}{{${fieldName} | ${defaultValue}}}`;
      this.localMessageValue.content = value;
    }
  }

  onChangeFile(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    const file: File = (target.files as FileList)[0];

    this.imageFile = file;
    const reader = new FileReader();
    if (file) {
      reader.readAsDataURL(this.imageFile);
    }
    reader.onload = () => {
      this.messageImage = reader.result as string;
    };
    this.imageName = file.name as string;
  }

  async uploadImage() {
    const images = await this.apiService.uploadImages([
      {
        messageId: this.localMessageValue.id || 0,
        isAutomatedMessage: true,
        data: '' + (await this.getBase64(this.imageFile)),
        name: this.imageFile?.name || '',
      },
    ]);

    return images?.data[0].link;
  }

  async getBase64(file: any) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (file) {
        reader.readAsDataURL(file);
      }
      reader.onload = () => resolve(reader.result);
    });
  }

  removeFile() {
    if (!this.isMessageInUse) {
      this.imageFile = null;
      this.messageImage = '';
      this.imageName = '';
      (this.$refs.inputFile as HTMLInputElement).value = '';
    }
  }

  checkInputEmpty(text: string | undefined) {
    return text?.trim().length === 0;
  }

  isValidUrl(url: string): boolean {
    return /^(https?:\/\/)([a-z0-9\-]+\.)+[a-z]{2,63}(\/?\S*)?$/i.test(url);
  }

  isValidPlaceholder(url: string): boolean {
    return /^%.+%$/.test(url);
  }

  getImageName(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  @Watch('imageFile')
  loadImage() {
    this.isUploadImage = true;
  }

  @Watch('isNotificationExpiring')
  checkExpiring() {
    if (!this.isNotificationExpiring) {
      this.expireValue = null;
      this.localMessageValue.expiryPushInSeconds = null;
      this.localMessageValue.expiryPushFilter = null;
    }
  }

  @Watch('selectedSound')
  checkSelectedSound() {
    if (this.selectedSound === 'custom' && this.localMessageValue.notificationSound === 'default') {
      this.localMessageValue.notificationSound = '';
    }
    if (this.selectedSound === 'default') {
      this.localMessageValue.notificationSound = 'default';
    }
  }

  async sendMessageTeste() {
    if (!this.sendTestEmail) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.missEmailAndName') as string,
        leftBorder: false,
      });
      return;
    }

    const push = {
      email: this.sendTestEmail,
      message: {
        id: this.localMessageValue.id || 0,
        title: this.messageTitle,
        subject: this.localMessageValue.subject || '',
        content: this.localMessageValue.content || '',
        url: this.localMessageValue.url || '',
        type: this.messageType || '',
        expiryPushInSeconds: this.localMessageValue.expiryPushInSeconds || '',
      },
    } as SendMobilePushMessageDto;

    try {
      const response = await this.servicesService.sendMobilePush(push);
      const toast =
        response?.data?.status === 401
          ? { type: 'error', text: this.$t('modal.invalidContact') as string }
          : { type: 'success', text: this.$t('modal.mobilePushSent') as string };
      this.isSendingTest = false;
      this.toastService.show({
        ...toast,
        leftBorder: false,
      });
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: `${this.$t('warning.errorSendingEmail')}: ${error}`,
        leftBorder: false,
      });
      this.isSendingTest = false;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.push-card {
  background-color: $neutral-basic-white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  width: 100%;
  justify-content: space-between;
}

.emoji-input {
  z-index: 9;
  position: absolute;
  float: right;
  left: 50.2%;
}

.emoji-picker-size {
  min-width: 110%;
}

.picker-padding {
  padding-top: 22px;
}

.preview-height {
  height: fit-content;
}

.all-preview-width {
  width: 45%;
}

.preview-width {
  width: 400px;
}

.select-image-button {
  border-radius: 8px;
  height: 26px;
  width: fit-content;
  padding: 8px 12px 8px 12px;
  background-color: $ds-blue;
  color: $neutral-basic-white;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  letter-spacing: 0.07em;
  white-space: nowrap;
}

.select-width {
  width: fit-content !important;
}

.select-height {
  min-height: 36px;
}

.border-input {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  outline: none;
  -webkit-appearance: none;
}

.number-expire {
  max-width: 42px;
  min-height: 36px;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}

.initial-preview {
  border-top-right-radius: 40px;
  border-top-left-radius: 40px;
  background-color: black;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.initial-height {
  min-height: 100%;
  gap: 10%;
}

.expanded-height {
  min-height: 100%;
  gap: 8%;
}

.preview-color {
  background-color: $ds-gray-400;
}

.preview-top {
  align-items: flex-end;
}

.preview-speaker {
  border-radius: 4px;
  min-width: 60px;
  height: 5px;
}

.preview-camera {
  height: 5px;
  width: 5px;
  border-radius: 50%;
}

.preview-initial-screen {
  min-width: 90%;
  max-width: 90%;
  min-height: 60%;
  justify-content: center;
}

.preview-expanded-screen {
  min-width: 90%;
  max-width: 90%;
  min-height: 75%;
  justify-content: center;
}

.initial-notification {
  border-radius: 8px;
  background-color: $neutral-basic-white;
  min-height: 90%;
  width: 100%;
}

.notification-content {
  padding: 8px 10px 10px 8px;
}

.initial-preview-text {
  max-width: 70%;
  overflow: hidden;
}

.text-preview {
  white-space: pre-wrap;
  max-width: 100%;
  display: flex;
}

.image-border {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  align-self: center;
  padding: 8px;
}

.expanded-image-preview {
  min-height: 70px;
  max-height: 70px;
  min-width: 100%;
}

.device-switch {
  border-radius: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  padding: 10px;
  min-width: 100px;
  align-items: center;
  justify-content: center;
}

.logo-color {
  color: $ds-gray-400;
}

.background-selected {
  border-radius: 8px;
  background-color: $ds-blue-100;
}

.apple-icon {
  padding: 8px;
}

.initial-image-preview {
  max-height: 40px;
  max-width: 40px;
}

.unfilled-icon {
  color: $ds-gray-300;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important;
}

.buttons-style {
  height: 36px;
  border-radius: 8px;
}

.save-exit {
  border: 2px solid $ds-blue;
}

.create-button {
  background-color: $ds-blue;
}

.tooltip-icon:hover {
  cursor: default;
}

.unfilled-icon {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important;
}

.select-border:active {
  border: 1px solid $ds-blue;
}

.inputs-test {
  width: 35%;
}
</style>
