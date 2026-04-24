<template>
  <div>
    <v-card class="background-card message-form mt-2">
      <div class="push-column">
        <div class="emojis-picker">
          <InputDefault
            :name="`${$t('datatable.title')}`"
            data-cy="web-push-title"
            autofocus
            :modelValue="localMessageValue.subject"
            :placeholder="`${$t('input.messageTitle')}`"
            :keyInput="'subject'"
            max="60"
            :disabled="isMessageInUse"
            :inputIcon="inputSubject"
            @updateInput="updateInput"
            @buttonAction="toggleEmojiSubject"
          />
          <div class="emoji-box first-picker picker-padding">
            <VEmojiPicker
              v-show="showEmojiSubject"
              :style="{ width: '380px', height: '200' }"
              labelSearch="Search"
              lang="pt-BR"
              @select="onSelectEmojiPreview($event, 'subject')"
            />
          </div>
        </div>
        <div>
          <label class="label-title font-12 label-color mb-1">{{ $t('create.content') }}</label>
          <div class="div-row text-area-div">
            <textarea
              class="text-area-content"
              :placeholder="`${$t('input.messageContent')}`"
              id="content"
              name="content"
              rows="3"
              data-cy="web-push-title"
              autofocus
              v-model="localMessageValue.content"
              input="updateInput"
              :keyInput="'content'"
              :disabled="isMessageInUse"
            >
            </textarea>
            <span
              class="material-symbols-rounded unfilled-icon preview-icon icon-color cursor-pointer"
              @click="toggleEmojiContent"
              >sentiment_satisfied</span
            >
            <div class="emoji-box second-picker">
              <VEmojiPicker
                v-show="showEmojiContent"
                :style="{ width: '380px', height: '200' }"
                labelSearch="Search"
                lang="pt-BR"
                @select="onSelectEmojiPreview($event, 'content')"
              />
            </div>
          </div>
        </div>
        <div>
          <InputDefault
            :name="`${$t('title.redirectLink')}`"
            data-cy="web-push-link"
            autofocus
            :modelValue="localMessageValue.url"
            :placeholder="`${$t('input.messageLink')}`"
            @updateInput="updateInput"
            :keyInput="'url'"
            :disabled="isMessageInUse"
          />
        </div>
        <div class="input-image mb-2">
          <label class="label-title font-12 mb-1 label-color">{{ $t('title.image') }}</label>
          <div @click="onChangeFile" class="text-content image-file">
            <input
              type="file"
              id="push-image"
              name="push-image"
              accept="image/png, image/jpeg"
              @change="onChangeFile"
              ref="inputFile"
              :disabled="isMessageInUse"
            />
            <span class="material-symbols-rounded ds-gray-color cursor-pointer" v-if="imageFile === null">
              cloud_upload
            </span>
            <span
              class="material-symbols-rounded ds-gray-color cursor-pointer"
              v-if="imageFile !== null"
              @click="removeFile"
            >
              delete
            </span>
          </div>
        </div>
        <div class="div-column gap-5">
          <div class="div-row align-items-center gap-5">
            <input
              type="checkbox"
              key="expiration-notification"
              id="expiration-notification-checkbox"
              class="create-button cursor-pointer"
              v-model="setNotification"
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
              v-tooltip.right="$t('input.infoExpiryPush')"
            >
              info
            </span>
          </div>
          <div class="div-row gap-10 align-items-center" v-if="setNotification">
            <input
              type="number"
              class="border-input number-expire pl-2 pr-2 ds-gray-color"
              v-model="expireValue"
              :disabled="isMessageInUse"
            />
            <select
              class="select-height select-width select-border ds-gray-color border-input select-items-per-page font-12"
              v-model="localMessageValue.expiryPushFilter"
              :disabled="isMessageInUse"
            >
              <option v-for="expiryType in expiryPush" v-bind:value="expiryType.name" :key="expiryType.name">
                {{ expiryType.value }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="push-column">
        <div class="push-column">
          <label class="label-title font-12 mb-1 label-color">{{ $t('title.windowsPreview') }}</label>
          <div class="preview-windows mb-3">
            <img class="icon-preview" :src="imageData === '' ? briusLogo : imageData" alt="" />
            <div class="push-column pl-5 pt-1">
              <input
                class="text-color"
                readonly
                disabled
                :placeholder="`${$t('create.messageTitle')}`"
                v-model="localMessageValue.subject"
              />
              <p
                class="text-color-content pb-3 pr-5"
                v-if="localMessageValue.content === '' || localMessageValue.content === undefined"
              >
                {{ $t('create.messageContent') }}
              </p>
              <p class="text-color-content message-content-windows pb-3 pr-5" v-else>{{ localMessageValue.content }}</p>
              <input class="text-color-content link-color pt-3" readonly disabled placeholder="brius.com.br" />
            </div>
          </div>
          <label class="label-title font-12 mb-1 label-color">{{ $t('title.androidPreview') }}</label>
          <div class="preview-windows preview-android pt-1 pb-1">
            <div class="push-column">
              <div class="div-row p-3">
                <div class="push-column">
                  <div class="div-row align-items-start">
                    <img src="../../../assets/chrome-icon-android.svg" class="chrome-icon" alt="" />
                    <span class="message-android chrome-title mb-0 pl-1">Chrome ·</span>
                    <input
                      class="message-android mb-0 pl-1 pr-1"
                      readonly
                      disabled
                      size="5"
                      placeholder="brius.com.br"
                    />
                    <span class="message-android mb-0">· {{ $t('title.now') }}</span>
                    <span class="material-symbols-rounded ds-gray-color font-16">arrow_drop_up</span>
                  </div>
                  <input
                    class="text-color"
                    readonly
                    disabled
                    :placeholder="`${$t('create.messageTitle')}`"
                    v-model="localMessageValue.subject"
                  />
                  <p
                    class="text-color-content"
                    v-if="localMessageValue.content === '' || localMessageValue.content === undefined"
                  >
                    {{ $t('create.messageContent') }}
                  </p>
                  <p class="text-color-content message-content-android" v-else>{{ localMessageValue.content }}</p>
                </div>
                <img class="icon-preview m-2 p-2 mr-2" :src="imageData === '' ? briusLogo : imageData" alt="" />
              </div>
              <p class="align-title mb-2 mt-2">{{ $t('button.settings') }}</p>
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
            : $router.push('/messages/web-push')
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
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '../dtos/message.dto';
import ToastService from '@/services/toast.service';
import MessagesService from '../services/messages.service';
import ApiService from '@/services/api.service';
import { VEmojiPicker } from 'v-emoji-picker';
import { LabelDto } from '@/modules/labels/dtos/label.dto';

@Component({
  components: { InputDefault, ButtonDefault, VEmojiPicker },
  providers: [MessagesService],
  props: ['messageValue', 'messageTitle', 'messageDescription', 'messageType', 'isMessageInUse', 'messageLabels'],
})
export default class WritePushMessage extends Vue {
  @Prop() messageValue!: any;
  @Prop() messageTitle!: string;
  @Prop() messageDescription!: string;
  @Prop() messageType!: any;
  @Prop() isMessageInUse!: any;
  @Prop() messageLabels!: LabelDto[];
  private readonly messagesService = new MessagesService();
  private readonly toastService = new ToastService();
  private readonly apiService = new ApiService();

  expiryPush: any = [
    { name: 'day', value: this.$t('title.days') },
    { name: 'hour', value: this.$t('title.hours') },
  ];

  imageFile: File | null = null;
  messageId = 0;
  isUploadImage = false;
  imageData = '';
  briusLogo = '';
  savingMessage = false;
  setNotification = false;
  isNotAvailable = false;
  localMessageValue = { subject: '' } as MessageDto;
  showEmojiSubject = false;
  showEmojiContent = false;
  expireValue!: number | null;
  inputSubject = [{ icon: 'sentiment_satisfied', type: 'unfilled', action: 'emojiSubject' }];

  async beforeMount() {
    this.briusLogo = require('@/assets/brius-logo-blue.svg');
    if (this.$route.params.message_id) {
      this.localMessageValue = this.messageValue;
      if (this.localMessageValue.expiryPushInSeconds) {
        this.expireValue =
          this.localMessageValue.expiryPushFilter === 'day'
            ? (this.localMessageValue.expiryPushInSeconds || 0) / 60 / 60 / 24
            : (this.localMessageValue.expiryPushInSeconds || 0) / 60 / 60;
        this.setNotification = true;
      }
      this.imageData = this.localMessageValue.image || '';
    }
  }

  mounted() {
    document.addEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  beforeDestroy() {
    document.removeEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  toggleEmojiSubject() {
    this.showEmojiSubject = !this.showEmojiSubject;
    this.showEmojiContent = false;
  }

  toggleEmojiContent() {
    this.showEmojiContent = !this.showEmojiContent;
    this.showEmojiSubject = false;
  }

  onSelectEmojiPreview(emoji: any, input: string) {
    if (input === 'subject') {
      const value = `${this.localMessageValue.subject}${emoji.data}`;
      this.localMessageValue.subject = value;
      this.toggleEmojiSubject();
    }
    if (input === 'content') {
      const value = `${this.localMessageValue.content || ''}${emoji.data}`;
      this.localMessageValue.content = value;
      this.toggleEmojiContent();
    }
  }

  closeEmojiPickerIfClickedOutside(event: MouseEvent) {
    const subjectPicker = this.$el.querySelector('.emoji-box .first-picker');
    const previewPicker = this.$el.querySelector('.emoji-box .second-picker');
    const subjectButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.emojiSubject');
    const previewButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.preview-icon');

    if (event.target !== subjectPicker && event.target !== subjectButton) {
      this.showEmojiSubject = false;
    }
    if (event.target !== previewPicker && event.target !== previewButton) {
      this.showEmojiContent = false;
    }
  }

  updateInput(event: any, keyInput: keyof MessageDto) {
    this.localMessageValue[keyInput] = event;
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
      this.imageData = reader.result as string;
    };
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
    this.imageFile = null;
    this.imageData = '';
    (this.$refs.inputFile as HTMLInputElement).value = '';
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
          : this.$router.push('/messages/web-push');
      }
    } catch (error) {
      this.savingMessage = false;

      this.toastService.show({
        type: 'error',
        text: this.$t('toast.error') as string,
      });
    }
  }

  @Watch('setNotification')
  changeSetNotification() {
    if (!this.setNotification) {
      this.expireValue = null;
      this.localMessageValue.expiryPushInSeconds = null;
      this.localMessageValue.expiryPushFilter = null;
    }
  }

  isValidUrl(url: string): boolean {
    return /^(https?:\/\/)([a-z0-9\-]+\.)+[a-z]{2,63}(\/?\S*)?$/i.test(url);
  }

  isValidPlaceholder(url: string): boolean {
    return /^%.+%$/.test(url);
  }

  @Watch('imageFile')
  loadImage() {
    this.isUploadImage = true;
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
.input-font {
  font-size: 12px !important;
}
.message-form {
  display: flex;
  flex-direction: row;
  gap: 20px;
}
.align-title-android {
  align-items: self-start;
}
.align-title {
  text-align: center;
  font-weight: 600;
}
.push-column {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.preview-windows .push-column ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}

.preview-windows .push-column .message-form ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}

.text-area-div {
  position: relative;
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
  min-height: 36px;
  margin-bottom: 1em;
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
.image-file {
  align-items: center;
  display: flex;
  padding-top: 8px;
  justify-content: space-between;
  padding-right: 12px;
}
textarea:focus {
  outline: none !important;
  border: 1px solid $ds-blue;
}
.text-content input {
  cursor: pointer;
}
.preview-windows {
  box-shadow: 0px 1px 2px rgb(0 0 0 / 6%), 0px 1px 3px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: row;
}
.preview-android {
  border-radius: 10px;
}
.chrome-icon {
  height: 15px;
  width: 18px;
}
.message-android {
  color: #6b6b6b !important;
  font-size: 10px;
  font-weight: 200;
}
.icon-preview {
  height: 100px;
  width: 125px;
}
.text-color {
  padding: 2px;
  margin: 0px !important;
  font-size: 12px;
  font-weight: 600;
}
.text-color-content {
  margin: 0px !important;
  padding: 2px;
  font-size: 12px;
  height: 45px;
  overflow: hidden;
}
.link-color {
  color: #c0c0c0 !important;
  height: 20px !important;
}

.chrome-title {
  height: 20px !important;
  align-self: flex-end;
}
::v-deep .v-label {
  margin-bottom: 0px !important;
}

.text-error {
  color: $ds-red;
}

.message-content-android {
  max-width: 300px;
  max-height: 400px;
}

.message-content-windows {
  max-width: 300px;
  max-height: 200px;
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
.select-width {
  width: fit-content !important;
}

.select-height {
  min-height: 36px;
}

.select-border:active {
  border: 1px solid $ds-blue;
}

.emojis-picker {
  display: flex;
}
.emojis-button {
  flex-direction: column;
  position: relative;
}
.emojis-picker button {
  padding: 5px;
}
.emoji-box {
  z-index: 9;
  position: absolute;
  float: right;
}

.first-picker {
  left: 49.7%;
}

.second-picker {
  left: 100.3%;
}

.picker-padding {
  padding-top: 22px;
}

.icon-color {
  color: $ds-gray-400;
  position: absolute;
  top: 0;
  right: 0;
  margin: 1px;
  padding: 4px;
  &:hover {
    background-color: $ds-gray-100;
    border-radius: 50%;
  }
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}

::v-deep .v-input__control {
  height: 36px !important;
}
</style>
