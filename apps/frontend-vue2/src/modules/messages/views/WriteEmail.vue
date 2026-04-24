<template>
  <div class="mt-2">
    <v-card class="background-card">
      <section class="div-row gap-15">
        <div class="input-container">
          <div class="col-12">
            <div class="row">
              <div class="col-6 pb-0">
                <label class="label-title font-12 label-color mb-1">{{ $t('sidebar.sender') }}</label>
                <select
                  data-cy="automation-message-ippool"
                  class="form-control mo-select border-color font-12"
                  v-model="poolSender"
                  @change="selectPool($event.target.value)"
                  :disabled="isMessageInUse"
                >
                  <option disabled selected value="">{{ $t('input.selectSender') }}</option>
                  <option v-for="pool in ipPools" :value="pool.id" :key="'pool-' + pool.id">
                    {{ pool.senderEmail }}
                  </option>
                </select>
              </div>

              <div class="col-6 pb-0" id="writeEmail-senderName" v-if="showSender">
                <label class="label-title font-12 label-color mb-1">{{ $t('create.senderName') }}</label>
                <InputDefault
                  data-cy="name"
                  :modelValue="newEmailFormGroup.props.fromName"
                  :placeholder="`${$t('input.senderName')}`"
                  @updateInput="updateInput"
                  :keyInput="'fromName'"
                  :disabled="isMessageInUse"
                />
                <div v-if="newEmailFormGroup.controls.fromName.dirty && newEmailFormGroup.controls.fromName.errors">
                  <small
                    data-cy="name-error"
                    class="form-text text-danger"
                    v-html="newEmailFormGroup.controls.fromName.errorMessage"
                  ></small>
                </div>
                <div v-if="hasInvalidCharacters">
                  <small class="form-text text-danger">{{ $t('input.invalidCharactersWithEmoji') }}</small>
                </div>
              </div>
            </div>
          </div>
          <div class="col-12 pt-0 pb-0">
            <label class="label-title font-12 label-color mb-1">{{ $t('create.subject') }}</label>
            <div class="emojis-picker">
              <InputDefault
                data-cy="subject"
                autofocus
                :modelValue="newEmailFormGroup.props.subject"
                :placeholder="`${$t('input.emailSubject')}`"
                @updateInput="updateInput"
                :keyInput="'subject'"
                :disabled="isMessageInUse"
                :inputIcon="inputSubject"
                @buttonAction="toogleDialogEmojiSubject"
              />
              <div class="emoji-box first-picker">
                <VEmojiPicker
                  v-show="showDialogSubject"
                  :style="{ width: '440px', height: '200' }"
                  labelSearch="Search"
                  lang="pt-BR"
                  @select="onSelectEmojiSubject"
                />
              </div>
            </div>
            <div v-if="newEmailFormGroup.controls.subject.dirty && newEmailFormGroup.controls.subject.errors">
              <small
                data-cy="subject-error"
                class="form-text text-danger"
                v-html="newEmailFormGroup.controls.subject.errorMessage"
              >
              </small>
            </div>
          </div>
          <div class="col-12 pt-0 pb-2">
            <label class="label-title font-12 label-color mb-1">{{ $t('create.preview') }}</label>
            <div class="emojis-picker">
              <InputDefault
                data-cy="preview"
                autofocus
                :modelValue="newEmailFormGroup.props.previewText"
                :placeholder="`${$t('input.emailPreview')}`"
                @updateInput="updateInput"
                :keyInput="'previewText'"
                :disabled="isMessageInUse"
                :inputIcon="inputPreview"
                @buttonAction="toogleDialogEmojiPreview"
              />
              <div class="emoji-box second-picker">
                <VEmojiPicker
                  v-show="showDialogPreview"
                  :style="{ width: '440px', height: '200' }"
                  labelSearch="Search"
                  lang="pt-BR"
                  @select="onSelectEmojiPreview"
                />
              </div>
            </div>
            <div v-if="newEmailFormGroup.controls.previewText.dirty && newEmailFormGroup.controls.previewText.errors">
              <small
                data-cy="preview-error"
                class="form-text text-danger"
                v-html="newEmailFormGroup.controls.previewText.errorMessage"
              >
              </small>
            </div>
          </div>
          <div class="col-12 pt-0 pb-2">
            <label class="mt-0 label-title font-12 label-color mb-1"> {{ $t('title.contentConfig') }} </label>
            <div class="buttons-email gap-15">
              <ButtonDefault
                :name="`${$t('button.showFields')}`"
                @click="viewFields"
                data-cy="button-view-fields"
                class="btn btn-c btn-light btn-light-c button-view-fields"
                :disabled="isMessageInUse"
              />
              <ButtonDefault
                :name="`${$t('button.conditionalEmail')}`"
                @click="viewConditional"
                data-cy="button-generate-url"
                class="btn btn-c btn-light btn-light-c button-generate-url"
                :disabled="isMessageInUse"
              />
              <ButtonDefault
                v-if="isInternal"
                :name="`${$t('button.generateLinks')}`"
                @click="viewGenerateLinks"
                data-cy="button-generate-url"
                class="btn btn-c btn-light btn-light-c button-generate-url"
                :disabled="isMessageInUse"
              />
              <ButtonDefault
                :name="`${$t('button.uploadImage')}`"
                @click="viewUploadImage"
                data-cy="button-generate-url"
                class="btn btn-c btn-light btn-light-c button-generate-url"
                :disabled="isMessageInUse"
              />
            </div>
          </div>
          <div class="col-12 pt-0">
            <label class="mt-3 label-title font-12 label-color mb-1"> {{ $t('create.template') }} </label>
            <v-autocomplete
              class="template-autocomplete font-12"
              item-text="name"
              item-value="json_template"
              :placeholder="`${$t('input.search')}`"
              v-model="templateSelected"
              :items="templates"
              :search-input.sync="templateName"
              :no-data-text="`${$t('datatable.noData')}`"
              :disabled="isMessageInUse"
              solo
              :multiple="false"
            >
            </v-autocomplete>
          </div>
          <div v-if="isCampaignTemplate" class="col-12 pt-0 div-column">
            <label class="label-title font-12 label-color mb-1">{{ $t('input.linkRedirect') }}</label>
            <div class="div-row gap-10 align-items-end">
              <InputDefault
                :modelValue="redirectLink"
                :placeholder="`${$t('input.linkRedirect')}`"
                :keyInput="'redirectLink'"
                @updateInput="updateRedirectLink"
                :disabled="isMessageInUse"
              />
              <ButtonDefault
                :name="`${$t('button.apply')}`"
                @click="replaceLink"
                :disabled="isMessageInUse || !redirectLink.trim()"
                class="btn btn-c btn-light btn-light-c"
              />
            </div>
          </div>
        </div>
        <div class="preview-container">
          <div class="prev">
            <div v-if="isMobilePreview" class="prev-mob-container">
              <div class="prev-mob-data d-flex justify-content-between align-items-center">
                <p>12:30</p>
                <div class="prev-mob-data-icons">
                  <span class="material-symbols-rounded font-24 p-2"> signal_cellular_alt </span>
                  <span class="material-symbols-rounded font-24 p-2"> wifi </span>
                  <span class="material-symbols-rounded font-24 p-2"> battery_full_alt </span>
                </div>
              </div>
              <div class="prev-page">
                <div class="prev-page-header d-flex justify-content-between align-items-center">
                  <span class="material-symbols-rounded font-12 p-2 prev-icon-gray"> arrow_back_ios </span>
                  <span v-if="isMobilePreview"><h3>Caixa de Entrada</h3></span>
                  <span class="material-symbols-rounded font-24 p-2 prev-icon-gray"> more_vert </span>
                </div>
                <div class="prev-page-msg d-flex justify-content-between">
                  <div class="prev-page-msg-lft-content d-flex">
                    <span class="prev-initials-div">{{ senderInitials }}</span>
                    <div class="prev-page-msg-text">
                      <h3>{{ newEmailFormGroup.props.fromName }}</h3>
                      <h4>{{ newEmailFormGroup.props.subject }}</h4>
                      <p>{{ newEmailFormGroup.props.previewText }}</p>
                    </div>
                  </div>
                  <span class="prev-page-msg-time">19:31</span>
                </div>
                <div class="prev-page-empty-spc"></div>
              </div>
            </div>
            <div v-if="!isMobilePreview" class="prev-desk-container">
              <div class="prev-desk-data d-flex justify-content-between align-items-center">
                <div class="prev-desk-data-icons div-row w-100 justify-content-between">
                  <div class="action-buttons div-row">
                    <div class="red"></div>
                    <div class="yellow"></div>
                    <div class="green"></div>
                  </div>
                  <div class="long-bar"></div>
                </div>
              </div>
              <div class="prev-page">
                <div class="prev-page-header d-flex justify-content-between align-items-center">
                  <span><h3>Caixa de Entrada</h3></span>
                  <span class="material-symbols-rounded font-24 p-2 prev-icon-gray"> more_vert </span>
                </div>
                <div class="prev-page-msg d-flex justify-content-between">
                  <div class="prev-page-msg-lft-content d-flex align-items-center">
                    <div class="d-flex align-items-center">
                      <input type="checkbox" disabled />
                      <h3>{{ newEmailFormGroup.props.fromName }}</h3>
                    </div>
                    <div class="prev-page-msg-text">
                      <h4>{{ newEmailFormGroup.props.subject }}</h4>
                      <p>{{ newEmailFormGroup.props.previewText }}</p>
                    </div>
                  </div>
                  <span class="prev-page-msg-time">19:31</span>
                </div>
                <div class="prev-page-empty-spc"></div>
              </div>
            </div>
          </div>
          <div class="device-switch d-flex">
            <span
              :class="['material-symbols-rounded font-24 p-2 cursor-pointer', { activeDevice: isMobilePreview }]"
              @click="isMobilePreview = true"
            >
              smartphone
            </span>
            <span
              :class="['material-symbols-rounded font-24 p-2 cursor-pointer', { activeDevice: !isMobilePreview }]"
              @click="isMobilePreview = false"
            >
              computer
            </span>
          </div>
        </div>
      </section>
      <EmailTemplate
        v-if="!isMessageInUse && localMessageValue.content_json !== null"
        class="email-template"
        ref="emailTemplate"
        :message="localMessageValue"
        :contentJson="contentJson"
        :showSender="true"
        :showButtonContinue="false"
        :messageId="localMessageValue.id"
        :isAutomatedMessage="true"
        :title="localMessageValue.title"
        :isMessageInUse="isMessageInUse"
        @onChangeMessage="onChangeMessage"
        @validEmail="validEmail"
      >
      </EmailTemplate>
      <div
        v-if="isMessageInUse || (localMessageValue.content && localMessageValue.content_json === null)"
        class="d-flex message-preview mb-4"
        v-html="localMessageValue.content"
      ></div>
      <div v-if="isSuperAdmin" class="col-12 pt-0 pb-2 px-4">
        <label class="label-title font-12 label-color mb-1">HTML Customizado (SuperAdmin)</label>
        <textarea
          v-model="customHtmlContent"
          class="custom-html-textarea"
          placeholder="Cole o HTML customizado aqui. Se preenchido, este HTML sera usado ao inves do conteudo do Unlayer."
          :disabled="isMessageInUse"
        ></textarea>
      </div>
      <div v-if="isInternal" class="col-12 div-row gap-10 align-items-center justify-content-start">
        <button
          :class="{ 'import-disabled': isMessageInUse }"
          :disabled="isMessageInUse"
          v-tooltip.right="$t('button.importContent')"
          @click="importContent"
        >
          <span :class="{ 'button-hover': !isMessageInUse }" class="material-symbols-rounded ds-gray-color font-20">
            download
          </span>
        </button>
        <button v-tooltip.right="$t('button.exportContent')" @click="exportContent">
          <span class="material-symbols-rounded ds-gray-color font-20 button-hover"> upload </span>
        </button>
        <button
          v-if="localMessageValue.content || localMessageValue.content_json || contentJson"
          v-tooltip.right="$t('button.copy') + ' HTML'"
          @click="copyHtmlContent"
        >
          <span class="material-symbols-rounded ds-gray-color font-20 button-hover"> content_copy </span>
        </button>
        <button
          class="open-link-button"
          v-if="localMessageValue.templateUrl"
          v-tooltip.right="$t('button.openInNew')"
          @click="openInNew"
        >
          <span class="material-symbols-rounded ds-gray-color font-18 button-hover"> open_in_new </span>
        </button>
      </div>
    </v-card>
    <AlertComponent type="info" :showIcon="true" :isExpandable="true" @openAlert="getOpen">
      <div class="div-column font-14" :class="{ 'mb-2': openAlert }">
        <span class="text-600">
          {{ $t('alert.templateTitle') }}
        </span>
        <div class="div-column" :class="openAlert ? 'expand-div' : 'close-div'">
          <div class="div-column gap-15">
            <span>
              {{ $t('alert.templateLink') }}
            </span>
            <span>
              {{ $t('alert.templateAttention') }}
            </span>
          </div>
          <span class="alert-list-item">
            {{ $t('alert.templatePixel') }}
          </span>
          <span class="alert-list-item">
            {{ $t('alert.templateHref') }}
          </span>
          <span class="alert-list-item">
            {{ $t('alert.templateSend') }}
          </span>
          <span class="alert-list-item">
            {{ $t('alert.templateImages') }}
          </span>
        </div>
      </div>
    </AlertComponent>
    <span class="font-16 ds-gray-color text-600 title-spacing">{{ $t('title.sendAsTest') }}</span>
    <div class="test-message mt-2">
      <form @submit.prevent="sendTestEmail">
        <div class="div-row gap-15">
          <div class="div-column inputs-test">
            <label class="label-title label-color font-12 text-600 mb-1">{{ $t('create.addresseeName') }}</label>
            <input
              class="form-control"
              data-cy="automation-send-email-name"
              :placeholder="`${$t('input.addresseeName')}`"
              v-model="testEmail.firstName"
            />
          </div>
          <div class="div-column inputs-test">
            <label class="label-title label-color font-12 text-600 mb-1">{{ $t('create.addresseeEmail') }}</label>
            <input
              class="form-control"
              data-cy="automation-send-email-email"
              :placeholder="`${$t('input.addresseeEmail')}`"
              v-model="testEmail.email"
            />
          </div>
          <div class="d-flex align-end flex-end">
            <ButtonDefault
              type="submit"
              class="btn btn-c btn-light btn-light-c cursor-pointer"
              :name="`${$t(isSendingEmail ? 'button.sending' : 'button.sendTest')}`"
              bind:class="{isSendingEmail: isSendingEmail}"
              :disabled="isSendingEmail"
              :loading="isSendingEmail"
            />
          </div>
        </div>
      </form>
    </div>
    <div class="col-12 pr-0 footer-buttons">
      <input class="cancel-button" text @click="cancelButtonClick()" type="button" :value="`${$t('button.cancel')}`" />
      <ButtonDefault
        :name="localMessageValue.id ? `${$t('button.save')}` : `${$t('button.create')}`"
        @click="checkCharacters"
        :loading="isSaving"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c"
        :disabled="newEmailFormGroup.invalid || (oldEditor && !isFormTemplateValid) || isSaving || isMessageInUse"
      />
    </div>
    <v-dialog v-model="showSaveDialog" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6" style="white-space: pre-line; word-break: keep-all">{{
          $t('toast.specialCharacters')
        }}</v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <input
            class="cancel-button mr-4"
            text
            @click="showSaveDialog = false"
            type="button"
            :value="`${$t('button.cancel')}`"
          />
          <ButtonDefault
            class="btn btn-c btn-lg btn-success btn-success-c"
            text
            @click="buttonSave"
            :name="$t('input.yes')"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="showGenerateLinksDialog" persistent max-width="600px">
      <div class="div-column gap-5 px-4 pt-2 pb-4 generate-links-dialog link-dialog-height">
        <div class="div-row justify-content-between align-items-center">
          <span class="font-14 text-600">{{ $t('button.generateLinks') }}</span>
          <button class="d-flex align-items-center" @click="closeLinksModal()">
            <span class="material-symbols-rounded ds-light-gray-color text-600 close-icon trash-can-icon">
              close_small
            </span>
          </button>
        </div>
        <div class="div-column gap-10 h-100">
          <div
            v-for="(option, optionIndex) in linksList"
            :key="'list-options' + optionIndex"
            class="div-row items-active gap-8"
          >
            <input
              type="text"
              :placeholder="`${$t('input.typeHere')}`"
              :value="option"
              id="youridhere"
              class="d-flex input-link font-12"
              @input="createOption(optionIndex, $event.target.value)"
            />
            <button
              class="cursor-pointer"
              @click="removeOption(optionIndex)"
              type="button"
              style="z-index: 10"
              v-if="linksList.length > 1"
            >
              <span class="material-symbols-rounded ds-light-gray-color trash-can-icon">delete</span>
            </button>
          </div>
          <button class="d-flex add-link align-items-center text-600 font-12 justify-content-end" @click="addLink()">
            <span class="material-symbols-rounded"> add </span>
            {{ $t('sidebar.add') }}
          </button>
          <div class="d-flex array-input-links">
            <span class="font-12 ds-gray-color links-list">
              {{ linksList }}
            </span>
            <span
              class="font-20 ds-gray-color material-symbols-rounded copy-icon unfilled-icon cursor-pointer align-self-start align-items-end"
              @click="copyToClipboard(linksList, 'linksList')"
            >
              content_copy
            </span>
          </div>
        </div>
      </div>
    </v-dialog>
    <v-dialog v-model="showUploadImageDialog" persistent max-width="600px">
      <ImageUpload
        :isMessageInUse="isMessageInUse"
        :messageId="localMessageValue.id"
        @closeUploadImageDialog="closeUploadImageDialog"
      />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import EmailTemplate from '@/components/form-write-email/EmailTemplate.vue';
import { NewEmailForm } from '../forms/newEmailForm';
import MesssagesService from '../services/messages.service';
import LoadingService from '@/services/loading.service';
import ServicesService from '../services/services.service';
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-forms';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { SendEmailMessageDto } from '../dtos/send-email.dto';
import { EmailFormProps } from '../dtos/send-email.dto';
import ToastService from '@/services/toast.service';
import store from '@/store';
import { MessageInterface, WriteEmailInterface } from '../interfaces/write-email.interface';
import { EmailTemplateInterface } from '@/modules/templates/interfaces/email-template.interface';
import InputDefault from '@/components/input/InputDefault.vue';
import { VEmojiPicker } from 'v-emoji-picker';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import {
  isEmptyValue,
  hasEmojiCharacters,
  hasEspecialCharacters,
  setTwoFaConfig,
  getTwoFaConfig,
  getTwoFaCurrentGroup,
} from '../../../util/objects';
import { PoolDto } from '@/modules/pools/dtos/pool.dto';
import MessageCardComponent from '@/modules/campaigns/components/MessageCardComponent.vue';
import AlertComponent from '@/components/alert/AlertComponent.vue';
import { MessageDto } from '../dtos/message.dto';
import ModalService from '@/services/modal.service';
import ViewFields from '@/components/form-write-email/modal-fields/ViewFields.vue';
import EmailConditionalModal from '@/components/form-write-email/EmailConditionalModal.vue';
import { TemplateDto } from '@/modules/templates/dtos/template.dto';
import TemplateService from '@/modules/templates/services/template.service';
import { debounce } from '@/util/debounce';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import ApiService from '@/services/api.service';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import htmlTemplate from '@/modules/campaigns/components/template-json/html-template.json';
import { LabelDto } from '@/modules/labels/dtos/label.dto';
import ImageUpload from '@/components/image-upload/ImageUpload.vue';

@Component({
  components: {
    VEmojiPicker,
    EmailTemplate,
    InputDefault,
    ButtonDefault,
    MessageCardComponent,
    AlertComponent,
    DataLoader,
    ImageUpload,
  },
  providers: [MesssagesService, LoadingService],
  props: [
    'messageValue',
    'messageTitle',
    'messageDescription',
    'messageType',
    'isMessageInUse',
    'isCampaignTemplate',
    'messageId',
    'messageLabels',
  ],
  computed: {
    ...mapState(['currentAccount', 'isSuperAdmin']),
  },
})
export default class WriteEmail extends Vue {
  @Prop() messageValue!: any;
  @Prop() messageTitle!: string;
  @Prop() messageDescription!: string;
  @Prop() messageType!: any;
  @Prop() isMessageInUse!: boolean;
  @Prop() isCampaignTemplate!: boolean;
  @Prop() messageId!: string;
  @Prop() messageLabels!: LabelDto[];
  public currentAccount!: AccountDto;
  public isSuperAdmin!: boolean;
  private readonly messagesService = new MesssagesService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  private readonly servicesService = new ServicesService();
  private readonly modalService = new ModalService();
  private readonly templateService = new TemplateService();
  private readonly apiService = new ApiService();

  templateSelected = '';
  contentJson = '';
  templates: TemplateDto[] = [];
  lastSearch = '';
  templateName = '';
  isMobilePreview = true;
  senderInitials: any = '';
  inputSubject = [{ icon: 'sentiment_satisfied', type: 'unfilled', action: 'emojiSubject' }];
  inputPreview = [{ icon: 'sentiment_satisfied', type: 'unfilled', action: 'emojiPreview' }];
  hidden = false;
  isSaving = false;
  isSendingEmail = false;
  hasInvalidCharacters = false;
  didWarn = false;
  showSaveDialog = false;
  isFormTemplateValid = false;
  alertMessage = {
    subscribe: this.$t('warning.unsubscribe'),
    subscribeExample: this.$t('warning.clickHere'),
    pixel: this.$t('warning.pixel'),
    pixelExample: this.$t('warning.request'),
  };
  oldEditor = false;
  updatedMessage: MessageInterface = {} as MessageInterface;
  formBuilder = new RxFormBuilder();
  newEmailFormGroup: IFormGroup<NewEmailForm>;
  editorJson: any;
  editorHtml: any;
  showSender = true;
  showDialogSubject = false;
  showDialogPreview = false;
  ipPools: any = [];
  poolSender: number | undefined = 0;
  defaultPool: PoolDto = {} as PoolDto;
  isNotAvailable = false;
  localMessageValue: MessageDto = {};
  showGenerateLinksDialog = false;
  prioritys: any = [
    { name: 'Baixa', value: 'low' },
    { name: 'Normal - Default', value: 'normal' },
    { name: 'Alta', value: 'high' },
  ];

  testEmail: { firstName: string; email: string } = {
    firstName: '',
    email: '',
  };
  openAlert = false;
  linksList = [''];
  linksListIndex = 0;
  isInternal = false;
  showUploadImageDialog = false;
  isLoadingImproveMessage = false;
  templateContent = '';
  redirectLink = '';
  currentRedirectLink = '';
  customHtmlContent = '';

  get currentGroup() {
    return getTwoFaCurrentGroup();
  }

  constructor() {
    super();
    this.newEmailFormGroup = this.formBuilder.formGroup(NewEmailForm) as IFormGroup<NewEmailForm>;
  }

  debouncedSearchTemplate = debounce(async (search: string) => await this.getTemplates(search), 300);

  async beforeMount() {
    await this.getPools();
    await this.getMessage();
    await this.getTemplates();
    this.isInternal = this.currentAccount.isInternal || false;
  }

  mounted() {
    document.addEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  beforeDestroy() {
    document.removeEventListener('click', this.closeEmojiPickerIfClickedOutside);
  }

  closeEmojiPickerIfClickedOutside(event: MouseEvent) {
    const subjectPicker = this.$el.querySelector('.emoji-box .first-picker');
    const previewPicker = this.$el.querySelector('.emoji-box .second-picker');
    const subjectButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.emojiSubject');
    const previewButton = this.$el.querySelector('.material-symbols-rounded.unfilled-icon.emojiPreview');

    if (event.target !== subjectPicker && event.target !== subjectButton) {
      this.showDialogSubject = false;
    }
    if (event.target !== previewPicker && event.target !== previewButton) {
      this.showDialogPreview = false;
    }
  }

  async getTemplates(text?: string) {
    try {
      const result = await this.templateService.getTemplates({ name: text, page: 1, itemsPerPage: 10, sortBy: 'name' });
      this.templates = result.data?.results;
    } catch (err) {
      console.error(err);
    }
  }

  validEmail(isValid: boolean) {
    this.isFormTemplateValid = isValid;
  }
  toogleDialogEmojiSubject() {
    this.showDialogSubject = !this.showDialogSubject;
    this.showDialogPreview = false;
  }

  toogleDialogEmojiPreview() {
    this.showDialogPreview = !this.showDialogPreview;
    this.showDialogSubject = false;
  }

  updateInput(event: any, keyInput: keyof NewEmailForm) {
    this.newEmailFormGroup.props[keyInput] = event;
    this.checkValues();
  }

  onSelectEmojiSubject(emoji: any) {
    const value = `${this.newEmailFormGroup.props.subject}${emoji.data}`;
    this.showDialogSubject = !this.showDialogSubject;
    this.newEmailFormGroup.props.subject = value;
  }

  onSelectEmojiPreview(emoji: any) {
    const value = `${this.newEmailFormGroup.props.previewText}${emoji.data}`;
    this.showDialogPreview = !this.showDialogPreview;
    this.newEmailFormGroup.props.previewText = value;
  }

  async getPools() {
    this.ipPools = (await this.messagesService.getPools())?.data;
    this.defaultPool = this.ipPools.find((pool: PoolDto) => pool.isDefault === true) || this.ipPools[0];
  }

  async getMessage() {
    if (this.isCampaignTemplate) {
      this.localMessageValue = this.messageValue;
    }
    const messageId = +this.$route.params.message_id;
    if (messageId) {
      this.localMessageValue = this.messageValue;
      this.poolSender = this.ipPools.find((pool: PoolDto) => pool.poolName === this.localMessageValue.ippool).id;
      this.populateTitle();
      if (this.isSuperAdmin && this.localMessageValue.content && this.localMessageValue.content_json == null) {
        this.customHtmlContent = this.localMessageValue.content;
      }
    } else {
      this.poolSender = this.defaultPool.id;
      this.selectPool(this.defaultPool.id);
      this.newEmailFormGroup.props.priority = 'high';
    }
  }

  onChangeMessage(message: MessageInterface) {
    this.updatedMessage = message;
    this.$forceUpdate();
  }

  selectPool(id: number | undefined) {
    if (!id) {
      return;
    }

    const pool: PoolDto = this.ipPools.find((item: PoolDto) => item.id === Number(id));
    this.newEmailFormGroup.props.ippool = pool.poolName;
    this.newEmailFormGroup.props.fromMail = pool.senderEmail;
    this.newEmailFormGroup.props.replyTo = pool.senderReplyTo;
    if (!this.newEmailFormGroup.props.fromName) {
      this.newEmailFormGroup.props.fromName = pool.senderName;
    }
  }

  async saveMessage() {
    const payload = {
      title: this.messageTitle,
      description: this.messageDescription,
      labels: this.messageLabels,
      ippool: this.newEmailFormGroup.props.ippool,
      priority: this.newEmailFormGroup.props.priority,
      type: this.messageType,
      fromName: this.newEmailFormGroup.props.fromName,
      fromMail: this.newEmailFormGroup.props.fromMail,
      content: this.editorHtml,
      content_json: this.editorJson,
      text: this.editorHtml,
      replyTo: this.newEmailFormGroup.props.replyTo,
      subject: this.newEmailFormGroup.props.subject,
      previewText: this.newEmailFormGroup.props.previewText,
      isTested: this.localMessageValue.isTested || false,
      providerMessageId: this.messageId,
    };

    if (this.localMessageValue && this.localMessageValue.id) {
      return this.messagesService.updateMessage({ ...payload, id: this.localMessageValue.id });
    }
    return this.messagesService.createMessage(payload);
  }

  populateTitle() {
    this.newEmailFormGroup.props.ippool = this.localMessageValue.ippool;
    this.newEmailFormGroup.props.priority = this.localMessageValue.priority;
    this.newEmailFormGroup.props.fromMail = this.localMessageValue.fromMail;
    this.newEmailFormGroup.props.fromName = this.localMessageValue.fromName;
    this.newEmailFormGroup.props.replyTo = this.localMessageValue.replyTo;
    this.newEmailFormGroup.props.subject = this.localMessageValue.subject;
    this.newEmailFormGroup.props.previewText = this.localMessageValue.previewText;
  }

  validateForm() {
    this.$emit('onFormEmailChange', this.newEmailFormGroup);
  }

  async checkCharacters() {
    if (!hasEmojiCharacters(this.newEmailFormGroup.props.fromName)) {
      this.hasInvalidCharacters = true;
      (document.querySelector('#writeEmail-senderName input') as HTMLFormElement).focus();

      this.toastService.show({
        type: 'error',
        text: this.$t('toast.haveEmoji') as string,
      });
      return false;
    }

    if (!hasEspecialCharacters(this.newEmailFormGroup.props.fromName)) {
      (document.querySelector('#writeEmail-senderName input') as HTMLFormElement).focus();
      this.showSaveDialog = true;
      return false;
    }

    await this.buttonSave();
  }

  validateMessagePlaceholder(message: string): Array<string> {
    return this.messagePlaceholderChecker(message);
  }

  messagePlaceholderChecker(message: string): string[] {
    function removeHtmlTags(input: string) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input, 'text/html');
      return doc.body.textContent || '';
    }

    function findPlaceholders(text: string): string[] {
      const placeholderRegex = /%\w+%/g;
      const _placeholders = text.match(placeholderRegex);
      return _placeholders || [];
    }

    function checkMessage(_message: string, placeholderText: string): string[] {
      const brokenPlaceholders: string[] = [];
      const textSplittedByPercentage = _message.split('%');
      for (const value of textSplittedByPercentage) {
        const text = removeHtmlTags(value);
        if (`%`.concat(text).concat(`%`).trim().match(RegExp(placeholderText))) {
          if (text !== value) {
            brokenPlaceholders.push(value);
          }
        }
      }
      return brokenPlaceholders;
    }

    function checkMessageForPlaceholders(_message: string, _placeholders: string[]): string[] {
      const brokenPlaceholders: string[] = [];
      for (const placeholder of _placeholders) {
        brokenPlaceholders.push(...checkMessage(_message, placeholder));
      }
      return Array.from(new Set(brokenPlaceholders));
    }

    const messageWithoutHtmlTags = removeHtmlTags(message);
    const placeholders = findPlaceholders(messageWithoutHtmlTags);
    const cleanedMessage = checkMessageForPlaceholders(message, placeholders);

    return cleanedMessage;
  }

  async buttonSave() {
    this.isSaving = true;
    this.showSaveDialog = false;

    if (this.isSuperAdmin && this.customHtmlContent.trim()) {
      await this.saveWithCustomHtml();
      return;
    }

    const editorEmail: unknown = this.$refs.emailTemplate as unknown;
    const writeEmailInterface: WriteEmailInterface = editorEmail as WriteEmailInterface;
    const editorEmailInterface: EmailTemplateInterface = writeEmailInterface.$refs
      .emailEditor as EmailTemplateInterface;
    editorEmailInterface.editor.exportHtml(async (data: any) => {
      if (isEmptyValue(data)) {
        this.isSaving = false;
        this.toastService.show({
          type: 'error',
          text: this.$t('toast.waitUntilEditorIsLoaded') as string,
        });
        return;
      }

      const validatePlaceholder = this.validateMessagePlaceholder(data.html);
      if (validatePlaceholder.length) {
        this.isSaving = false;
        this.toastService.show({
          type: 'error',
          text: this.$t('toast.invalidPlaceholder', { value: validatePlaceholder.join(' | ') }) as string,
        });
        return;
      }

      const {
        design: { body },
      } = data;
      const { rows } = body;
      let isEmpty = true;
      let validationMessage = '';
      validateMessage: for (let i = 0; i < rows.length; i++) {
        const { columns } = rows[i];
        for (let j = 0; j < columns.length; j++) {
          const { contents } = columns[j];
          if (contents && contents.length) {
            isEmpty = false;
            for (const content of contents) {
              validationMessage = await this.validateContent(content);
              if (validationMessage) {
                break validateMessage;
              }
            }
          }
        }
      }

      if (validationMessage) {
        this.isSaving = false;
        this.toastService.show({
          type: 'error',
          text: validationMessage,
        });
        return;
      }

      if (isEmpty) {
        this.isSaving = false;
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.messageEmpty') as string,
        });
        return;
      }

      this.editorJson = JSON.stringify(data.design);
      this.editorHtml = data.html;
      this.loadingService.show();
      try {
        const response = await this.saveMessage();

        if (response && response.data && response.data.id) {
          this.toastService.show({
            type: 'success',
            text: this.$t('toast.success') as string,
          });

          if (this.isCampaignTemplate) {
            this.$emit('createdTemplateMessage', {
              id: response.data.id,
              title: response.data.title,
              subject: response.data.subject,
              fromName: response.data.fromName,
              url: response.data.url || null,
            });
            return;
          }

          let routerPath = '';

          if (this.messageType.startsWith('2FA')) {
            const messageType = this.messageType.replace('2FA-', '');

            const newConfig = {
              message: {
                id: response.data.id,
                title: response.data.title,
                subject: response.data.subject,
                fromName: response.data.fromName,
                url: response.data.url || null,
              },
              percentage: 0,
            };

            if (this.currentGroup) {
              const tempConfigs = getTwoFaConfig(messageType, {});
              if (!tempConfigs[this.currentGroup]) {
                tempConfigs[this.currentGroup] = [];
              }
              tempConfigs[this.currentGroup].push(newConfig);
              setTwoFaConfig(messageType, tempConfigs);

              this.$router.push(`/messages/2FA/${messageType}/${this.currentGroup}`);
            } else {
              this.$router.push(`/messages/2FA/${messageType}`);
            }
            return;
          } else if (store.state.hasGlockApp) {
            routerPath = `/messages/email/${response.data.id}/deliverability-test`;
          }
          if (!store.state.hasGlockApp && !this.messageType.startsWith('transactional')) {
            routerPath = `/messages/email`;
          }
          if (!store.state.hasGlockApp && this.messageType.startsWith('transactional')) {
            routerPath = '/automations/transactional';
          }

          this.$router.push(routerPath);
        }
      } finally {
        this.isSaving = false;
      }
    });
  }

  async saveWithCustomHtml() {
    this.editorJson = null;
    this.editorHtml = this.customHtmlContent.trim();
    this.loadingService.show();
    try {
      const response = await this.saveMessage();

      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.success') as string,
        });

        if (this.isCampaignTemplate) {
          this.$emit('createdTemplateMessage', {
            id: response.data.id,
            title: response.data.title,
            subject: response.data.subject,
            fromName: response.data.fromName,
            url: response.data.url || null,
          });
          return;
        }

        let routerPath = '';

        if (this.messageType.startsWith('2FA')) {
          const messageType = this.messageType.replace('2FA-', '');

          const newConfig = {
            message: {
              id: response.data.id,
              title: response.data.title,
              subject: response.data.subject,
              fromName: response.data.fromName,
              url: response.data.url || null,
            },
            percentage: 0,
          };

          if (this.currentGroup) {
            const tempConfigs = getTwoFaConfig(messageType, {});
            if (!tempConfigs[this.currentGroup]) {
              tempConfigs[this.currentGroup] = [];
            }
            tempConfigs[this.currentGroup].push(newConfig);
            setTwoFaConfig(messageType, tempConfigs);

            this.$router.push(`/messages/2FA/${messageType}/${this.currentGroup}`);
          } else {
            this.$router.push(`/messages/2FA/${messageType}`);
          }
          return;
        } else if (store.state.hasGlockApp) {
          routerPath = `/messages/email/${response.data.id}/deliverability-test`;
        }
        if (!store.state.hasGlockApp && !this.messageType.startsWith('transactional')) {
          routerPath = `/messages/email`;
        }
        if (!store.state.hasGlockApp && this.messageType.startsWith('transactional')) {
          routerPath = '/automations/transactional';
        }

        this.$router.push(routerPath);
      }
    } finally {
      this.isSaving = false;
    }
  }

  async validateContent(content: any): Promise<string> {
    let isValid = '';
    const { type, values } = content;
    switch (type) {
      case 'text':
        const textDiv = document.createElement('div');
        textDiv.innerHTML = values.text;
        const textString = textDiv.textContent || textDiv.innerText || '';
        if (textString === 'This is a new Text block. Change the text.') {
          isValid = this.$t('warning.messageEmptyText') as string;
        }
        break;
      case 'image':
        if (values?.src?.url === `https://cdn.tools.unlayer.com/image/placeholder.png` || values?.src?.url === '') {
          isValid = this.$t('warning.messageEmptyImage') as string;
        }
        break;
      case 'button':
        if (values?.href?.values?.href === '') {
          isValid = this.$t('warning.messageEmptyButton') as string;
        }
        break;
      case 'heading':
        if (values.text === 'Heading') {
          isValid = this.$t('warning.messageEmptyHeading') as string;
        }
        break;
      case 'html':
        const htmlDiv = document.createElement('div');
        htmlDiv.innerHTML = values.html;
        const htmlText = htmlDiv.textContent || htmlDiv.innerText || '';
        if (htmlText === 'Hello, world!') {
          isValid = this.$t('warning.messageEmptyHtml') as string;
        }
        break;
      default:
        break;
    }
    return isValid;
  }

  validateObject(emailObject: any, validations: string[], emptyFields: string[]) {
    for (const [key, value] of Object.entries(emailObject)) {
      if (validations.includes(key) && isEmptyValue(value)) {
        this.isSendingEmail = false;
        emptyFields.push(key);
      }
    }
    return emptyFields;
  }

  async sendTestEmail() {
    if (this.testEmail.firstName === '' || this.testEmail.email === '') {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.missEmailAndName') as string,
        leftBorder: false,
      });
      return;
    }

    this.isSendingEmail = true;
    if (this.isMessageInUse || (!this.localMessageValue.content_json && this.localMessageValue.content)) {
      this.sendMessageContent(this.localMessageValue.content);
    } else {
      const editorEmail: unknown = this.$refs.emailTemplate as unknown;
      const writeEmailInterface: WriteEmailInterface = editorEmail as WriteEmailInterface;
      const editorEmailInterface: EmailTemplateInterface = writeEmailInterface.$refs
        .emailEditor as EmailTemplateInterface;

      editorEmailInterface.editor.exportHtml(async (data: any) => {
        if (isEmptyValue(data)) {
          this.isSendingEmail = false;
          this.toastService.show({
            type: 'error',
            text: this.$t('toast.waitUntilEditorIsLoaded') as string,
          });
          return;
        }
        this.sendMessageContent(data.html);
      });
    }
  }

  async sendMessageContent(html: any) {
    const email = {
      contact: {
        email: this.testEmail.email,
        firstName: this.testEmail.firstName,
      },
      message: {
        id: this.localMessageValue.id,
        title: this.messageTitle,
        previewText: this.newEmailFormGroup.props.previewText,
        ippool: this.newEmailFormGroup.props.ippool,
        subject: this.newEmailFormGroup.props.subject,
        replyTo: this.newEmailFormGroup.props.replyTo,
        priority: this.newEmailFormGroup.props.priority,
        content: html,
        from: {
          firstName: this.newEmailFormGroup.props.fromName,
          email: this.newEmailFormGroup.props.fromMail,
        },
      },
      loadContactFromDatabase: true,
    } as SendEmailMessageDto;

    let emptyFields: string[] = [];
    const validations = ['title', 'subject', 'email', 'firstName', 'content'];

    emptyFields = this.validateObject(email.message, validations, emptyFields);
    emptyFields = this.validateObject(email.message.from, validations, emptyFields);

    if (emptyFields.length > 0) {
      const translatedFields = emptyFields.map((field) => this.$t(`validate.${field}`));
      const errorFields = translatedFields.join(', ');
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.emptyFields', { fields: errorFields }) as string,
      });
      return;
    }

    try {
      await this.servicesService.sendEmail(email);
      this.isSendingEmail = false;
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.emailSent') as string,
        leftBorder: false,
      });
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: `${this.$t('warning.errorSendingEmail')}: ${error}`,
        leftBorder: false,
      });
      this.isSendingEmail = false;
    }
  }
  viewFields() {
    this.modalService.customDialog({
      title: this.$t('create.messageFields') as string,
      customComponent: ViewFields,
      customTitleClass: 'list-fields-modal-title',
      width: 765,
      showClose: true,
    });
  }

  viewConditional() {
    this.modalService.customDialog({
      title: this.$t('button.conditionalEmail') as string,
      customComponent: EmailConditionalModal,
      customTitleClass: 'list-conditional-modal-title',
      width: 765,
      showClose: true,
    });
  }

  viewGenerateLinks() {
    this.showGenerateLinksDialog = true;
  }

  addLink() {
    this.linksList.push('');
    this.linksListIndex++;
  }

  createOption(index: number, option: string) {
    this.linksList[index] = option;
    this.linksList.push();
  }

  removeOption(index: number) {
    this.linksList.splice(index, 1);
    this.linksListIndex--;
  }

  copyToClipboard(link: string | string[], type: string) {
    if ((Array.isArray(link) && link.every((item) => item === '')) || link === '') {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.noLink') as string,
      });
    } else if (type === 'linksList') {
      navigator.clipboard.writeText(JSON.stringify(link));
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.linksCopied') as string,
      });
    } else if (type === 'imageLink') {
      navigator.clipboard.writeText(link as string);
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.imageLinkCopied') as string,
      });
    }
  }

  closeLinksModal() {
    this.showGenerateLinksDialog = false;
  }

  getInitials() {
    const fullName = this.newEmailFormGroup.props.fromName;
    const names = fullName.trim().split(/\s+/);

    if (names.length === 1) {
      this.senderInitials = names[0].substring(0, 2).toUpperCase();
      return this.senderInitials;
    } else {
      const firstInitial = names[0][0];
      const lastInitial = names[names.length - 1][0];
      this.senderInitials = (firstInitial + lastInitial).toUpperCase();
      return this.senderInitials;
    }
  }

  getOpen(value: any) {
    this.openAlert = value;
  }

  async importContent() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (event: any) => {
          try {
            let fileContent = event.target.result as string;

            fileContent = fileContent.trim();

            if (fileContent.charCodeAt(0) === 0xfeff) {
              fileContent = fileContent.slice(1);
            }

            let jsonContent = JSON.parse(fileContent);

            if (typeof jsonContent === 'string') {
              try {
                jsonContent = JSON.parse(jsonContent);
              } catch (e) {
                throw new Error('Invalid double-encoded JSON structure');
              }
            }

            if (this.localMessageValue.id) {
              this.localMessageValue.content_json = JSON.stringify(jsonContent);
            }
            this.contentJson = JSON.stringify(jsonContent);

            this.toastService.show({
              type: 'success',
              text: this.$t('toast.contentImported') as string,
            });
          } catch (error) {
            console.error('Import error:', error);
            this.toastService.show({
              type: 'error',
              text: this.$t('toast.invalidJsonFile') as string,
            });
          }
        };

        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.errorImportingContent') as string,
      });
    }
  }

  exportContent() {
    let contentToExport = '';

    if (!this.localMessageValue.id && this.contentJson) {
      contentToExport = this.contentJson;
    } else if (this.localMessageValue.content_json) {
      contentToExport = this.localMessageValue.content_json;
    }

    if (contentToExport) {
      const parsedContent = typeof contentToExport === 'string' ? JSON.parse(contentToExport) : contentToExport;
      const contentStr = JSON.stringify(parsedContent, null, 2);

      const blob = new Blob([contentStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'email-content.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.toastService.show({
        type: 'success',
        text: this.$t('toast.contentExported') as string,
      });
    } else {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.noContentToExport') as string,
      });
    }
  }

  copyHtmlContent() {
    try {
      if (this.isMessageInUse || (!this.localMessageValue.content_json && this.localMessageValue.content)) {
        navigator.clipboard
          .writeText(this.localMessageValue.content || '')
          .then(() => {
            this.toastService.show({
              type: 'success',
              text: this.$t('toast.copiedToClipboard') as string,
            });
          })
          .catch(() => {
            this.toastService.show({
              type: 'error',
              text: this.$t('toast.errorExportingContent') as string,
            });
          });
      } else {
        const editorEmail: unknown = this.$refs.emailTemplate as unknown;
        const writeEmailInterface: WriteEmailInterface = editorEmail as WriteEmailInterface;
        const editorEmailInterface: EmailTemplateInterface = writeEmailInterface.$refs
          .emailEditor as EmailTemplateInterface;

        editorEmailInterface.editor.exportHtml((data: any) => {
          if (data && data.html) {
            navigator.clipboard
              .writeText(data.html)
              .then(() => {
                this.toastService.show({
                  type: 'success',
                  text: this.$t('toast.copiedToClipboard') as string,
                });
              })
              .catch(() => {
                this.toastService.show({
                  type: 'error',
                  text: this.$t('toast.errorExportingContent') as string,
                });
              });
          } else {
            this.toastService.show({
              type: 'error',
              text: this.$t('toast.noContentToExport') as string,
            });
          }
        });
      }
    } catch (error) {
      console.error('Error copying HTML content:', error);
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.errorExportingContent') as string,
      });
    }
  }

  openInNew() {
    window.open(this.localMessageValue.templateUrl, '_blank');
  }

  viewUploadImage() {
    this.showUploadImageDialog = true;
  }

  closeUploadImageDialog() {
    this.showUploadImageDialog = false;
  }

  @Watch('templateName')
  searchTemplate(text: string, oldValue: any) {
    if ((text && text !== this.lastSearch) || typeof oldValue === 'string') {
      this.debouncedSearchTemplate(text);
      this.lastSearch = text;
    }
  }

  @Watch('newEmailFormGroup')
  checkValues() {
    const initials = this.getInitials();

    const requiredFields: (keyof EmailFormProps)[] = ['subject', 'ippool', 'fromMail', 'fromName'];
    const allFilled = requiredFields.every((field) => this.newEmailFormGroup.props[field]);

    if (allFilled) {
      this.localMessageValue.subject = this.newEmailFormGroup.props.subject;
      this.localMessageValue.ippool = this.newEmailFormGroup.props.ippool;
      this.localMessageValue.priority = this.newEmailFormGroup.props.priority;
      this.localMessageValue.fromMail = this.newEmailFormGroup.props.fromMail;
      this.localMessageValue.replyTo = this.newEmailFormGroup.props.replyTo;
      this.localMessageValue.fromName = this.newEmailFormGroup.props.fromName;
      this.localMessageValue.previewText = this.newEmailFormGroup.props.previewText;
    }
  }

  @Watch('templateSelected')
  loadTemplate(value: any) {
    this.contentJson = typeof value === 'string' ? value : JSON.stringify(value);
  }

  @Watch('messageValue')
  changeMessage(value: any) {
    if (this.localMessageValue && value && value.id && this.localMessageValue.id !== value.id) {
      this.localMessageValue = value;
    }
  }

  cancelButtonClick() {
    if (this.isCampaignTemplate) {
      this.$emit('closeModal', true);
      return;
    }

    if (this.messageType.startsWith('transactional')) {
      this.$router.push('/automations/transactional');
      return;
    }

    if (this.messageType.startsWith('2FA-email') && this.currentGroup) {
      this.$router.push(`/messages/2FA/email/${this.currentGroup}`);
      return;
    }

    if (this.messageType.startsWith('2FA-email') && !this.currentGroup) {
      this.$router.push('/messages/2FA/email');
      return;
    }

    this.$router.push('/messages/email');
  }

  updateRedirectLink(value: string) {
    this.redirectLink = value;
  }

  replaceLink() {
    if (!this.redirectLink.trim()) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyRedirectLink') as string,
      });
      return;
    }

    try {
      if (this.localMessageValue.content_json) {
        let contentJson =
          typeof this.localMessageValue.content_json === 'string'
            ? JSON.parse(this.localMessageValue.content_json)
            : this.localMessageValue.content_json;

        const replaceInObject = (obj: any): any => {
          if (typeof obj === 'string') {
            return obj.replace(
              this.currentRedirectLink === ''
                ? /%URL_REDIRECT%/g
                : new RegExp(this.escapeRegExp(this.currentRedirectLink), 'g'),
              this.redirectLink
            );
          }
          if (Array.isArray(obj)) {
            return obj.map(replaceInObject);
          }
          if (obj && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                newObj[key] = replaceInObject(obj[key]);
              }
            }
            return newObj;
          }
          return obj;
        };

        contentJson = replaceInObject(contentJson);
        this.localMessageValue.content_json = JSON.stringify(contentJson);
        this.contentJson = JSON.stringify(contentJson);
      }

      if (this.localMessageValue.content) {
        this.localMessageValue.content = this.localMessageValue.content.replace(
          this.currentRedirectLink === ''
            ? /%URL_REDIRECT%/g
            : new RegExp(this.escapeRegExp(this.currentRedirectLink), 'g'),
          this.redirectLink
        );
      }

      this.$emit('onChangeMessage', this.localMessageValue);

      this.$forceUpdate();

      this.currentRedirectLink = this.redirectLink;

      this.toastService.show({
        type: 'success',
        text: this.$t('toast.linkReplaced') as string,
      });
    } catch (error) {
      console.error('Error replacing redirect link:', error);
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.errorReplacingLink') as string,
      });
    }
  }

  escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/bs-layout.scss';
@import '@/assets/styles/variables.scss';
.message-alert {
  padding-right: 0%;
}
.background-card {
  background-color: #ffffff;
  margin-bottom: 24px;
  border-radius: 14px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  flex-direction: column;
}

.input-container {
  width: 50%;
}

.template-autocomplete::v-deep .v-input__slot {
  margin-bottom: unset !important;
  box-shadow: none !important;
  border-radius: 8px !important;
  border: 1px solid $ds-gray-300 !important;
  &:focus-within {
    border: 1px solid $ds-blue !important;
  }
}

.preview-container {
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.prev {
  font-family: 'inter';
  width: 90%;
  padding-right: 15px;
}

.prev-page {
  border: 1px solid #d9d9d9;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
}

.prev-page-header {
  padding: 0 10px;
  border-bottom: 1px solid #d9d9d9;
  h3 {
    font-weight: 600;
    color: #5c5c5c;
  }
}

.prev-page-msg-text {
  color: #5c5c5c;

  h3 {
    margin-bottom: 3px;
    font-size: 16px;
    font-weight: 800;
  }

  h4 {
    font-size: 14px;
    font-weight: 600;
  }
}

.prev-mob-container {
  padding-top: 40px;

  .prev-page {
    height: 220px;
    border: 1px solid #d9d9d9;
  }

  .prev-page-header {
    height: 50px;
    color: #5c5c5c;

    h3 {
      margin-bottom: 0;
    }
  }

  .prev-page-msg-text {
    padding-left: 30px;
    h3 {
      margin-bottom: 3px;
      font-size: 16px;
      font-weight: 800;
      max-width: 270px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    h4 {
      font-size: 14px;
      font-weight: 600;
      max-width: 270px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    p {
      max-width: 270px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
.prev-desk-container {
  width: 100%;
  padding-top: 30px;

  .prev-page {
    height: 220px;
    border: 2px solid #d9d9d9;
  }

  .prev-page-header {
    height: 35px;

    h3 {
      margin: 0;
      font-size: 12px;
    }
  }

  .prev-page-msg {
    height: 30px;
    border: 1.2px solid #d9d9d9;
    border-left: 0;
    border-right: 0;
    color: #5c5c5c;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    h3 {
      margin: 0 0 0 8px;
      font-size: 10px;
      font-weight: 600;
      max-width: 80px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    h4 {
      margin-bottom: 0;
      margin-right: 12px;
      font-size: 10px;
      font-weight: 600;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    p {
      margin: 0;
      font-size: 8px;
      max-width: 250px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prev-page-msg-text {
      padding-left: 15px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }
  }

  .prev-page-msg-time {
    font-size: 8px;
    margin-top: -2px;
  }
}

.prev-desk-data {
  height: 50px;
  padding: 0 10px;
  border-radius: 8px 8px 0 0;
  background-color: #d9d9d9;
  color: white;

  .prev-desk-data-icons {
    .action-buttons {
      .red {
        height: 12px;
        width: 12px;
        border-radius: 50%;
        background-color: #f03232;
        margin-right: 7px;
      }
      .yellow {
        height: 12px;
        width: 12px;
        border-radius: 50%;
        background-color: #ffc500;
        margin-right: 7px;
      }
      .green {
        height: 12px;
        width: 12px;
        border-radius: 50%;
        background-color: #0fb75c;
        margin-right: 7px;
      }
    }
    .long-bar {
      width: 90%;
      height: 12px;
      background-color: $neutral-basic-white;
      border-radius: 10px;
    }
  }
}

.prev-mob-data {
  height: 40px;
  padding: 0 10px;
  border-radius: 8px 8px 0 0;
  background-color: #5c5c5c;
  color: white;
}

.prev-mob-data p {
  margin-bottom: 0;
  font-size: 16px;
  color: white;
}

.prev-page-msg {
  height: 75px;
  padding: 10px 15px;
}

.prev-initials-div {
  width: 40px;
  height: 40px;
  background-color: #0057f4;
  border-radius: 100%;
  text-align: center;
  line-height: 40px;
  color: white;
  font-size: 16px;
}

.prev-icon-gray {
  color: #5c5c5c;
}

.device-switch {
  margin-top: 15px;
  margin-bottom: 20px;
  border-radius: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 100px;
  align-items: center;
  justify-content: space-evenly;
  color: #5c5c5c;

  .activeDevice {
    color: #0057f4;
  }
}

.prev-page-empty-spc {
  height: 75px;
  border-top: 1px solid #d9d9d9;
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
  position: absolute;
  right: 0;
  z-index: 9;
  left: 98.2%;
}
.title-info {
  margin-left: 8px;
}
.v-toggle-automation {
  width: inherit;
}
::v-deep .theme--light.v-btn-toggle:not(.v-btn-toggle--group) {
  background-color: $ds-gray-100;
}
.v-btn-toggle-automation {
  width: 50%;
}

::v-deep .v-text-field__slot {
  height: 36px !important;
}
::v-deep .v-text-field--outlined .v-input__control .v-input__slot {
  min-height: 36px !important;
}
.message-label {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.label-tooltip {
  display: flex;
  align-items: center;
}

.label-tooltip div {
  margin-bottom: 2px;
}
.text-error {
  color: $ds-red;
}

.text-correct {
  color: #0fb75c;
}

.margin-priority {
  margin-top: 2.5px !important;
}

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

.message-preview {
  place-self: center;
  border-radius: 16px;
  border: 1px solid $ds-gray-300;
  overflow: hidden;
  min-height: fit-content;
  width: fit-content;
}
::v-deep .message-preview table {
  width: inherit !important;
  place-self: center;
}

.preview-content {
  width: 100%;
}

.priority-margin {
  margin-bottom: 3px;
}

.test-message {
  border-radius: 16px;
  background-color: #ffffff;
  padding: 20px;
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14);
}

.inputs-test {
  width: 35%;
}

.title-spacing {
  letter-spacing: 0.1rem;
}

.alert-list-item {
  display: list-item;
  margin-left: 25px;
}

.expand-div {
  display: flex;
  flex-direction: column;
}
.close-div {
  display: none;
}

.generate-links-dialog {
  width: 600px;
  background-color: $neutral-basic-white;
  border-radius: 16px;
}

.link-dialog-height {
  min-height: 250px;
}

.input-link {
  width: 100%;
  border-radius: 8px;
  border: 1px solid $ds-gray-300;
  height: 36px;
  padding: 0 10px;
  outline: none;
  &:focus {
    border: 1px solid $ds-blue;
  }
}

.trash-can-icon:hover {
  color: $ds-gray;
}

.array-input-links {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  padding: 10px;
  background-color: $ds-gray-100;
  min-height: 100px;
}

.add-link {
  border-radius: 24px;
  background-color: #0fb75c;
  text-transform: uppercase;
  color: #ffffff;
  width: fit-content;
  padding-right: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
  padding-left: 4px;
  align-items: center;
  outline: none;
  height: 26px;
  cursor: pointer;
}

.links-list {
  width: 95%;
}

.copy-icon {
  width: 5%;
  text-align: end;
}

.close-icon {
  font-size: 36px;
  margin-right: -6px;
}

.button-hover:hover {
  color: $ds-blue;
}

.import-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.open-link-button {
  margin-top: 2px;
}
.buttons-email {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.image-link-container {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  background-color: $neutral-basic-white;
}

.image-inputs {
  height: 36px;
  padding: 10px;
}

.image-size {
  max-width: 100%;
  max-height: 300px;
}

@keyframes rotateRight {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotate-icon {
  animation: rotateRight 2s linear infinite;
}

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px !important;
  display: flex;
  justify-content: center;
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
  background-color: white;

  &:focus {
    outline: none;
    border-color: $ds-blue;
    box-shadow: 0 0 0 2px rgba($ds-blue, 0.1);
  }

  &::placeholder {
    color: $ds-gray-400;
  }
}
.buttons-specs {
  max-height: 36px !important;
}

.custom-html-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  background-color: white;

  &:focus {
    outline: none;
    border-color: $ds-blue;
    box-shadow: 0 0 0 2px rgba($ds-blue, 0.1);
  }

  &::placeholder {
    color: $ds-gray-400;
  }

  &:disabled {
    background-color: $ds-gray-100;
    cursor: not-allowed;
  }
}
</style>
