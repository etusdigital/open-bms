<template>
  <div class="col-12 p-0">
    <div class="col-12 pt-0">
      <div class="col-12 p-0">
        <EmailEditor
          :appearance="appearance"
          :min-height="minHeight"
          :locale="locale"
          :options="editorOptions"
          ref="emailEditor"
          v-on:load="editorLoaded"
          v-on:ready="editorReady"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { SendEmailForm } from '@/components/form-write-email/sendEmailForm';
import ModalService from '@/services/modal.service';
import store from '@/store';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-forms';
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import { EmailEditor } from 'vue-email-editor';
import LoadingService from '@/services/loading.service';
import { EmailTemplateInterface } from '@/modules/templates/interfaces/email-template.interface';
import ApiService from '@/services/api.service';
import ButtonDefault from '../button/ButtonDefault.vue';

@Component({
  components: { EmailEditor, ButtonDefault },
  props: [
    'contentJson',
    'buttonContinue',
    'message',
    'showSender',
    'messageId',
    'isAutomatedMessage',
    'title',
    'isMessageInUse',
  ],
  store,
})
export default class EmailTemplate extends Vue {
  @Prop() contentJson!: string;
  @Prop() isMessageInUse!: boolean;

  private readonly modalService = new ModalService();
  private readonly loadingService = new LoadingService();
  private readonly apiService = new ApiService();

  formBuilder = new RxFormBuilder();
  sendEmailFormGroup: IFormGroup<SendEmailForm>;
  minHeight = '700px';
  appearance = {
    theme: 'dark',
  };
  locale = 'pt-BR';
  editorOptions = {
    // defaultDevice: 'mobile',
  };

  constructor() {
    super();
    this.sendEmailFormGroup = this.formBuilder.formGroup(SendEmailForm) as IFormGroup<SendEmailForm>;
  }

  editorReady() {
    const editorEmail: unknown = this.$refs.emailEditor as unknown;
    const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;
    editorEmailInterface.editor.setBodyValues({
      backgroundColor: '#FFFFFF',
    });

    if (this.$props.message.content_json) {
      editorEmailInterface.editor.loadDesign(JSON.parse(this.$props.message.content_json));
    }
  }

  editorLoaded() {
    const editorEmail: unknown = this.$refs.emailEditor as unknown;
    const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;
    editorEmailInterface.editor.registerCallback('image', async (file: any, done: any) => {
      const images = await this.apiService.uploadImages([
        {
          messageId: this.$props.messageId,
          isAutomatedMessage: true,
          data: '' + (await this.getBase64(file.attachments[0])),
          name: file.attachments[0].name,
        },
      ]);
      done({ progress: 100, url: images.data[0].link });
    });
  }

  getBase64(file: any) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
    });
  }

  @Watch('contentJson')
  loadTemplate() {
    this.$props.message.content_json = this.$props.contentJson;
    const editorEmail: unknown = this.$refs.emailEditor as unknown;
    const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;
    if (this.$props.contentJson) {
      editorEmailInterface.editor.loadDesign(JSON.parse(this.$props.contentJson));
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.footer-email-template {
  position: absolute !important;
  bottom: -62px;
}
label {
  margin-top: 17px !important;
}
.grid-header {
  display: grid;
  grid-gap: 0;
  grid-template-columns: auto max-content;
}

.flex-header {
  display: flex;
  flex-direction: column;
}

.form-control {
  font-size: 12px !important;
}
.form-control:disabled {
  color: #a6a6a6;
  border: unset !important;
}

.unlayer-editor iframe {
  position: absolute !important;
}

.template-autocomplete {
  box-shadow: none;
}

::v-deep .v-text-field.v-text-field--solo .v-input__control {
  min-height: 36px !important;
}

::v-deep .v-list-item__title {
  font-size: 12px !important;
}
</style>

<style lang="scss">
.unlayer-editor {
  position: relative;
  iframe {
    position: absolute !important;
  }
}
</style>
