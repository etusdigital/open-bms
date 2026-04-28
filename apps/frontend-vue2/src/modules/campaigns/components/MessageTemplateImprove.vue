<template>
  <div class="message-template-improve-card">
    <div class="message-body div-column">
      <div class="div-row justify-space-between align-items-center mb-3">
        <span class="font-14 text-600 ds-blue-color">
          {{ $t('title.improveTemplate') }}
        </span>
        <span
          class="material-symbols-rounded ds-gray-color cursor-pointer close-button font-24"
          @click.prevent="closeModal"
          >close
        </span>
      </div>

      <span class="font-16 text-600 ds-gray-color">{{ $t('title.details') }}</span>
      <v-card class="div-column card-name-desc mb-5 mt-2 gap-10">
        <div class="div-column">
          <InputDefault
            data-cy="custom-field-new-title"
            autofocus
            max="40"
            :name="`${$t('title.name')}`"
            :modelValue="currentMessage.title"
            :placeholder="`${$t('input.fieldName')}`"
            :keyInput="'title'"
            @updateInput="updateInput"
          />
          <span v-if="isNotAvailable" class="text-400 font-12 text-error message-alert">
            {{
              $t('alert.messageExist', {
                type: $t(`title.email`),
              })
            }}
          </span>
        </div>
        <InputDefault
          data-cy="custom-field-new-description"
          autofocus
          max="255"
          :name="`${$t('create.description')}`"
          :modelValue="currentMessage.description"
          :placeholder="`${$t('input.fieldDescription')}`"
          :keyInput="'description'"
          @updateInput="updateInput"
        />
      </v-card>

      <div v-if="this.currentMessage.content_json">
        <WriteEmail
          :messageValue="currentMessage"
          :messageTitle="currentMessage.title"
          :messageDescription="currentMessage.description"
          :messageId="messageId"
          :messageType="'email'"
          :isMessageInUse="false"
          :isCampaignTemplate="true"
          @createdTemplateMessage="createdTemplateMessage"
          @closeModal="closeModal"
          @onChangeMessage="onChangeMessage"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import ToastService from '@/services/toast.service';
import WriteEmail from '@/modules/messages/views/WriteEmail.vue';
import htmlTemplate from './template-json/html-template.json';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import InputDefault from '@/components/input/InputDefault.vue';
import { debounce } from '@/util/debounce';
import MessagesService from '@/modules/messages/services/messages.service';

@Component({
  components: { ButtonDefault, DataLoader, WriteEmail, InputDefault },
  props: ['content', 'messageId'],
})
export default class MessageTemplateImprove extends Vue {
  @Prop() content!: string;
  @Prop() messageId!: string;

  private readonly toastService = new ToastService();
  private readonly messagesService = new MessagesService();
  public currentMessage: MessageDto = { title: '', description: '' } as MessageDto;

  templateContent = '';
  improvedHtml = '';
  editorStatus = { type: '', message: '' };
  isNotAvailable = false;

  debouncedValidateName = debounce(() => this.validateMessageName(), 300);

  beforeMount() {
    this.improvedHtml = this.content;
    this.createTemplate();
  }

  closeModal() {
    this.$emit('closeModal');
  }

  mounted() {
    this.improvedHtml = this.content;
    this.injectHtmlToIframe(this.improvedHtml);
  }

  async validateMessageName() {
    try {
      if (this.currentMessage.title === undefined || this.currentMessage.title.length < 3) {
        return;
      }

      const { data } = await this.messagesService.checkAvailableName(this.currentMessage.title || '', 0, 'email');

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

  private injectHtmlToIframe(html: string) {
    return;
    // const iframe = this.$refs.iframe as HTMLIFrameElement;
    // const doc = iframe.contentDocument || iframe.contentWindow?.document;

    // if (!doc) {
    //   return;
    // }
    // doc.open();
    // doc.write(html);
    // doc.close();

    // if (doc.body) {
    //   doc.body.contentEditable = 'true';
    // }
  }

  @Watch('content')
  changeContent() {
    this.improvedHtml = this.content;
    this.templateContent = '';
    this.createTemplate();
  }

  updateInput(event: never, keyInput: never) {
    this.currentMessage[keyInput] = event;
    if (keyInput === 'title') {
      this.debouncedValidateName();
    }
  }

  createTemplate() {
    const htmlJsonClone = JSON.parse(JSON.stringify(htmlTemplate));
    htmlJsonClone.body.rows[0].columns[0].contents[0].values.html = this.improvedHtml;
    this.currentMessage.content_json = JSON.stringify(htmlJsonClone);
  }

  onChangeMessage(updatedMessage: any) {
    this.currentMessage = { ...this.currentMessage, ...updatedMessage };
  }

  createdTemplateMessage(createdMessage: any) {
    this.$emit('createdTemplateMessage', createdMessage);
    this.$emit('closeModal');
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

.message-template-improve-card {
  border-radius: 16px;
  background-color: #f5f5f5;
  display: flex;
  align-content: center;
  justify-content: center;
  padding: 20px;
  width: 90%;
  height: fit-content;
  max-height: 80vh;
  overflow-y: auto;
}

.close-button {
  display: flex;
  justify-content: center;
  padding: 3px;
  &:hover {
    border-radius: 50%;
    background-color: #f5f5f5;
  }
}

.message-body {
  width: -webkit-fill-available;
}

.textarea-container {
  width: 100%;
}

.template-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: $ds-blue;
    box-shadow: 0 0 0 2px rgba($ds-blue, 0.1);
  }

  &::placeholder {
    color: $ds-gray-400;
  }
}

.data-loader-card {
  width: 100%;
}

.buttons-specs {
  display: flex;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  box-shadow: none;
  font-weight: 700;
  font-size: 10px;
  max-height: 26px !important;
  padding: 15px !important;
  place-self: self-end;
  width: fit-content;
}

.w-40 {
  width: 40%;
}

.preview-template {
  width: 100%;
  height: 500px;
  border: none;
}

.editor-embed-container {
  margin-top: 20px;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.editor-embed-header {
  background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid $ds-gray-300;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: $ds-gray-300;
  }
}

.editor-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;

  &.success {
    background: #d4edda;
    color: #155724;
  }

  &.error {
    background: #f8d7da;
    color: #721c24;
  }

  &.info {
    background: #d1ecf1;
    color: #0c5460;
  }
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
</style>
