<template>
  <form class="m-0 col-12" @submit="buttonSave">
    <div>
      <v-card class="background-card d-flex div-column gap-20 card-name-description">
        <div>
          <label class="label-title font-12 d-flex mb-1 label-color">
            {{ $t('title.name') }}
            <div class="div-tooltip-img" v-tooltip.right="$t('datatable.templateName')">
              <span class="material-symbols-rounded ds-blue-color font-14">info</span>
            </div>
          </label>
          <InputDefault
            data-cy="web-push-new-title"
            autofocus
            :modelValue="currentTemplate.name"
            :placeholder="`${$t('input.templateName')}`"
            @updateInput="updateInput"
            :keyInput="'name'"
            max="40"
          />
        </div>
        <InputDefault
          data-cy="web-push-new-description"
          autofocus
          max="255"
          :name="`${$t('create.description')}`"
          :modelValue="currentTemplate.description"
          :placeholder="`${$t('input.templateDescription')}`"
          :keyInput="'description'"
          @updateInput="updateInput"
        />
      </v-card>
      <div>
        <EmailEditor
          :appearance="appearance"
          :min-height="minHeight"
          :locale="locale"
          ref="emailEditor"
          v-on:ready="editorReady"
          v-on:load="editorLoaded"
        />
      </div>
      <div class="footer-buttons mt-5">
        <input
          class="cancel-button"
          text
          @click="$router.push('/templates')"
          type="button"
          :value="`${$t('button.cancel')}`"
        />
        <ButtonDefault
          :name="`${$t('button.create')}`"
          data-cy="automation-message-save-btn"
          @click="buttonSave"
          class="btn btn-c btn-lg btn-success btn-success-c float-right"
          type="submit"
        />
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import { EmailEditor } from 'vue-email-editor';
import ToastService from '@/services/toast.service';
import { EmailTemplateInterface } from '@/modules/templates/interfaces/email-template.interface';
import TemplateService from '@/modules/templates/services/template.service';
import { TemplateDto } from '../dtos/template.dto';
import ApiService from '@/services/api.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: { EmailEditor, InputDefault, ButtonDefault },
  providers: [LoadingService],
})
export default class TemplatesCreate extends Vue {
  private readonly templateService = new TemplateService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  private readonly apiService = new ApiService();

  isFormTemplateValid = false;
  currentTemplate: TemplateDto = {} as TemplateDto;
  minHeight = '700px';
  appearance = {
    theme: 'dark',
  };
  locale = 'pt-BR';

  constructor() {
    super();
  }

  beforeMount() {
    this.getTemplate();
  }

  validEmail(isValid: boolean) {
    this.isFormTemplateValid = isValid;
  }

  editorReady() {
    const editorEmail: unknown = this.$refs.emailEditor as unknown;
    const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;
    if (this.currentTemplate.json_template) {
      editorEmailInterface.editor.loadDesign(JSON.parse(this.currentTemplate.json_template));
    }
  }

  async getTemplate() {
    const templateId = +this.$route.params.template_id;
    if (templateId) {
      this.currentTemplate = (await this.templateService.getTemplateById(templateId))?.data;
    }
  }

  async buttonSave(e: Event) {
    e.preventDefault();
    try {
      this.loadingService.show();
      const editorEmail: unknown = this.$refs.emailEditor as unknown;
      const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;

      editorEmailInterface.editor.exportHtml(async (data: any) => {
        let response;
        if (this.currentTemplate && this.currentTemplate.id) {
          response = await this.updateTemplate(this.currentTemplate.id, data.design, data.html);
        } else {
          response = await this.newTemplate(data.design, data.html);
        }
        this.loadingService.hide();
        if (response && response.data && response.data.id) {
          this.toastService.show({
            type: 'success',
            text: this.$t('modal.templateSaved') as string,
          });

          this.$router.push(`/templates`);
        }
      });
    } catch (error) {
      this.loadingService.hide();
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.errorSavingTemplate') as string,
      });
    }
  }

  async newTemplate(json: string, html: string) {
    return await this.templateService.createTemplate({
      name: this.currentTemplate.name,
      description: this.currentTemplate.description,
      html_template: html,
      json_template: JSON.stringify(json),
    });
  }

  async updateTemplate(id: number, json: string, html: string) {
    return await this.templateService.updateTemplate(id, {
      name: this.currentTemplate.name,
      description: this.currentTemplate.description,
      html_template: html,
      json_template: JSON.stringify(json),
    });
  }

  updateInput(event: string, key: keyof TemplateDto) {
    this.currentTemplate[key] = event;
  }

  editorLoaded() {
    const editorEmail: unknown = this.$refs.emailEditor as unknown;
    const editorEmailInterface: EmailTemplateInterface = editorEmail as EmailTemplateInterface;
    editorEmailInterface.editor.registerCallback('image', async (file: any, done: any) => {
      const images = await this.apiService.uploadImages([
        {
          messageId: 0,
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
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.title-info {
  margin-left: 4px;
}
.unlayer-editor iframe {
  position: absolute !important;
}
.unlayer-editor {
  position: relative;
  iframe {
    position: absolute !important;
  }
}
.label-tooltip {
  display: flex;
  flex-direction: row;
  margin-top: 5.5px;
}
</style>
