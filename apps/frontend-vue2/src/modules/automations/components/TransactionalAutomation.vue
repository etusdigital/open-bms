<template>
  <div class="automation">
    <div class="col-6 nopadding-right nopadding-left">
      <!-- <input
        data-cy="add-title-automation"
        v-if="isEditable"
        autofocus
        class="form-control"
        placeholder="Título da automação"
        v-model="automationForm.props.title"
      /> -->
      <InputDefault
        data-cy="add-title-automation"
        v-if="isEditable"
        autofocus
        :modelValue="automationForm.props.title"
        :placeholder="`${$t('input.automationTitle')}`"
        @updateInput="updateInput"
        :keyInput="'title'"
      ></InputDefault>
      <strong class="font-14" v-if="!isEditable">{{ automationForm.value.title }}</strong>
      <div v-if="automationForm.controls.title.errors && automationForm.controls.title.dirty">
        <small class="form-text text-danger" v-html="automationForm.controls.title.errorMessage"></small>
      </div>
    </div>

    <div class="automation_links">
      <div class="automation_links-message">
        <label class="div-row gap-1 align-items-center">
          <span class="material-symbols-rounded ds-gray-color font-24 mr-1">mail</span>
          <span>{{ $t('create.sendMessage') }}</span>

          <div v-if="!isEditable" class="automation_links-message_text">
            <button @click="preview">"{{ automationForm.value.message.title }}"</button>
          </div>
        </label>
        <v-autocomplete
          data-cy="message-automation"
          class="c-autocomplete elevation-0"
          :placeholder="`${$t('input.messageFetch')}`"
          v-if="isEditable"
          item-color="#EBE9E8"
          :no-data-text="
            isLoadingSearch
              ? $t('input.searching')
              : searchMessages
              ? $t('datatable.noData')
              : $t('datatable.noMessages')
          "
          :items="messages"
          v-model="automationForm.props.message"
          :return-object="true"
          item-text="title"
          :outlined="false"
          :search-input.sync="searchMessages"
          :loading="isLoadingSearch"
          @click="handleAutocompleteClick(searchMessages)"
          cache-items
          clearable
        >
        </v-autocomplete>
        <div v-if="automationForm.controls.message.errors && automationForm.touched">
          <small class="form-text text-danger" v-html="automationForm.controls.message.errorMessage"></small>
        </div>
      </div>
      <div class="line"></div>
    </div>
    <div data-cy="active-automation" class="active-automation row col-12 nopadding-right nopadding-left">
      <v-switch
        :data-cy="'switch-' + (automation.id ? automation.id : 0)"
        inset
        :ripple="false"
        :disabled="isEditable || !automationForm.value.message.title"
        color="#0057F4"
        class="col-6 switch automation_options-enable-switch nopadding-right nopadding-left"
        v-model="automation.isActive"
        :label="`${$t('create.automation')} ${automation.isActive ? $t('create.active') : $t('create.inactive')}`"
        @click="confirmSwitch()"
      ></v-switch>
      <div class="col-6 automation_options_actions nopadding-right nopadding-left">
        <div class="float-right">
          <button
            :data-cy="'button-edit-' + (automation.id ? automation.id : 0)"
            class="btn btn-c btn-lg btn-edit"
            :disabled="automation.isActive || isEditable"
            @click="editAutomation()"
          >
            {{ $t('button.edit') }}
          </button>
          <button
            :data-cy="'button-save-' + (automation.id ? automation.id : 0)"
            class="btn btn-c btn-lg btn-success btn-success-c"
            @click="confirm()"
            :disabled="automationForm.invalid || !isEditable"
          >
            {{ isNew ? `${$t('button.create')}` : `${$t('button.save')}` }}
          </button>
          <v-btn
            :disabled="automation.isActive"
            depressed
            class="btn btn-light btn-light-c btn-c-sm"
            @click="confirmDelete()"
            :data-cy="'button-delete-' + (automation.id ? automation.id : 0)"
          >
            <span class="material-symbols-rounded trash-can-icon">delete</span>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { IFormGroup, RxFormBuilder } from '@rxweb/reactive-forms';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { AutomationForm } from '../forms/automationForm';
import AutomationService from '../services/automations.service';
import MessagesService from '../../messages/services/messages.service';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { MessageDto } from '../../messages/dtos/message.dto';
import InputDefault from '@/components/input/InputDefault.vue';

@Component({
  components: { InputDefault },
  filters: {
    replace(value: string, searchValue: string, replaceValue: string) {
      return value ? value.replace(searchValue, replaceValue) : value;
    },
  },
})
export default class TransactionalAutomation extends Vue {
  private readonly loadingService = new LoadingService();
  private readonly automationService = new AutomationService();
  private readonly messagesService = new MessagesService();

  private readonly modalService = new ModalService();
  automationForm!: IFormGroup<AutomationForm>;
  formBuilder = new RxFormBuilder();

  @Prop() type!: string;
  @Prop() isNew!: boolean;
  @Prop() automation!: any;
  isEditable = false;

  messages: MessageDto[] = [];
  isLoadingSearch = false;
  searchMessages = '';
  saveSteps: [] = [];
  isInitialRequestMade = false;

  constructor() {
    super();
    this.automationForm = this.formBuilder.formGroup(AutomationForm) as IFormGroup<AutomationForm>;
  }

  beforeMount() {
    if (this.isNew) {
      this.isEditable = true;
    }
  }

  async mounted() {
    this.loadingService.show();
    try {
      if (!this.isNew && this.automation) {
        this.automationForm.controls.title.setValue(this.automation.title);
        this.automationForm.controls.message.setValue(this.automation.steps[0].settings);
        this.automationForm.controls.isActive.setValue(this.automation.isActive);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loadingService.hide();
    }
  }

  updateInput(event: any, keyInput: keyof AutomationForm) {
    this.automationForm.props[keyInput] = event;
  }

  confirm() {
    this.modalService.confirm({
      title: this.$t('create.saveAutomation') as string,
      text: `${this.$t('create.confirmAutomation', { automation: this.automationForm.props.title })}`,
      confirmLabel: this.$t('button.save') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.saveAutomation,
      isConfirm: true,
    });
  }

  confirmSwitch() {
    if (!this.isNew) {
      this.modalService.confirm({
        title: this.$t('create.activateAutomation') as string,
        text: `${this.$t('create.confirmActivation', {
          action: this.automation.isActive ? this.$t('create.activate') : this.$t('create.disable'),
          name: this.automation.title,
        })}`,
        confirmLabel: `${this.automation.isActive ? this.$t('create.activate') : this.$t('create.disable')}`,
        cancelLabel: this.$t('button.cancel') as string,
        cancelFunction: this.cancelSwitch,
        confirmFunction: this.patchAutomation,
        isConfirm: this.automation.isActive ? true : false,
      });
    }
  }

  async preview() {
    const message = (await this.messagesService.getMessageById(this.automationForm.controls.message.value.id))?.data;

    this.modalService.confirm({
      title: `${this.automationForm.value.title}`,
      text: `<b>Assunto</b>: ${message.subject}<br>
             <br> ${message.content}`,
      confirmLabel: this.$t('modal.completed') as string,
      cancelLabel: this.$t('modal.editMessage') as string,
      cancelFunction: this.editMessage,
      confirmFunction: this.cancel,
      width: 786,
      view: true,
      disabledCancel: this.automation.isActive,
      isConfirm: true,
    });
  }

  confirmDelete() {
    if (!this.isNew) {
      this.modalService.confirm({
        title: this.$t('modal.deleteAutomation') as string,
        text: `${this.$t('modal.confirmAutomation', { automation: this.automation.title })}`,
        confirmLabel: this.$t('button.delete') as string,
        cancelLabel: this.$t('button.cancel') as string,
        confirmFunction: this.deleteAutomation,
      });
    } else {
      this.cancel();
    }
  }

  async cancelSwitch() {
    this.automation.isActive = !this.automation.isActive;
  }

  async patchAutomation() {
    await this.automationService.patchAutomation({
      id: this.automation.id,
      isActive: this.automation.isActive,
    });
    this.submit();
  }

  async saveAutomation() {
    const newSteps = this.createSteps();
    if (this.isNew) {
      this.automationForm.controls.isActive.setValue(true);
      await this.automationService.createAutomation({
        title: this.automationForm.props.title,
        type: this.type,
        steps: newSteps,
        isActive: true,
        isRateLimit: false,
        stepId: 2,
      });
    } else {
      await this.automationService.updateAutomation({
        id: this.automation.id,
        title: this.automationForm.props.title,
        type: this.type,
        steps: newSteps,
        isRateLimit: false,
        isActive: this.automation.isActive,
        stepId: 2,
      });
    }

    this.isEditable = false;
    this.submit();
  }

  async editAutomation() {
    this.loadingService.show();

    this.isEditable = true;
    const stepMessage = this.automation.steps.find((step: { type: string }) => step.type === 'email');
    this.automationForm.props.title = this.automation.title;
    this.automationForm.props.message = stepMessage.settings;
    if (this.automation.steps) {
      this.messages = [stepMessage.settings.title];
    } else {
      this.automationForm.props.message = null;
    }

    this.edit();
    this.loadingService.hide();
  }

  async deleteAutomation() {
    if (this.isNew) {
      this.cancel();
    } else {
      await this.automationService.deleteAutomation(this.automation.id);
      this.delete();
    }
  }

  editMessage() {
    const route = this.$router.resolve({
      path: `/messages/email/${this.automationForm.controls.message.value.id}`,
    });
    window.open(route.href, '_blank');
  }

  async handleAutocompleteClick(search: string) {
    if (search && !this.isInitialRequestMade) {
      try {
        this.isInitialRequestMade = true;
        this.isLoadingSearch = true;

        const response: any = await this.messagesService.getMessages({
          title: search,
          page: 1,
          itemsPerPage: 40,
          type: 'email',
        });

        this.messages = response?.data?.results;
      } finally {
        this.isLoadingSearch = false;
      }
    }
  }

  @Watch('searchMessages')
  async onSearch(search: string) {
    if (search) {
      await this.updateEmailSearch(search);
    }
  }

  async updateEmailSearch(search: string): Promise<any> {
    this.isLoadingSearch = true;

    try {
      const response: any = await this.messagesService.getMessages({
        title: search,
        page: 1,
        itemsPerPage: 40,
        type: 'email',
      });
      this.messages = response.data?.results;
      return response.data;
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  edit() {
    this.$emit('edit', true);
  }

  submit() {
    this.$emit('submit', true);
  }

  cancel() {
    this.$emit('cancel', true);
  }

  delete() {
    this.$emit('delete', true);
  }

  createSteps() {
    return [
      {
        id: 1,
        type: 'email',
        child: [],
        settings: {
          id: this.automationForm.props.message.id,
          name: this.automationForm.props.message.name,
          title: this.automationForm.props.message.title,
          subject: this.automationForm.props.message.subject,
        },
      },
    ];
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

.automation_links-message_text > button {
  color: $ds-blue;
  margin-left: 0.5em;
  padding: 0;
}

@media (max-width: 1921px) {
  .automation_links-message_text,
  .tagName {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: fit-content;
  }
}

@media (min-width: 1442px) and (max-width: 1921px) {
  .automation_links-message_text,
  .tagName {
    max-width: 330px;
  }
}

@media (max-width: 1441px) {
  .automation_links-message_text,
  .tagName {
    max-width: 200px;
  }
}

@media (min-width: 1921px) {
  .tagTooltip {
    display: none;
  }
}

.automation {
  background: $neutral-basic-white;
  border: 1px solid $neutral-gray-300;
  border-radius: $spacing-xxs;
  padding: 20px $spacing-lg 32px $spacing-lg;

  input,
  .automation_links {
    margin-bottom: 0;
  }

  .automation_links {
    display: grid;
    grid-gap: 0;
    grid-template-columns: max-content auto max-content;

    .automation_links-tag,
    .automation_links-message,
    .automation_links-message::before {
      display: flex;
      height: 49px;
      width: fit-content;
      border-radius: $spacing-xs;
      padding: $spacing-xs $spacing-xs $spacing-xs 12px;
    }

    .automation_links-tag {
      background: $ds-blue;

      label {
        color: $neutral-gray-100;
        margin-right: 12px !important;
        display: flex;
      }

      .tagName {
        margin-left: 4px;
      }
    }

    .automation_links-message {
      background: white;
      border: 1px solid $neutral-gray-500;

      label {
        color: $neutral-gray-700;
        margin-right: 12px !important;
        margin-left: 24px !important;
        font-size: 14px;
        line-height: 17px;
        display: flex;

        img {
          font-size: 18px;
          vertical-align: bottom;
          margin-right: 12px;
        }
      }
    }

    .automation_links-message::before {
      content: '';
      width: 12px;
      background: $ds-blue;
      border-radius: $spacing-xs 0 0 $spacing-xs;
      padding: 0;
      margin: -9px -13px;
    }

    .automation_links-message .message-text:hover {
      text-decoration: underline;
    }
    .automation_links-message .message-text {
      margin-left: 4px;
    }
  }

  .automation_options_actions {
    padding-top: 0;
    margin: 0px 0px 0px !important;
    height: 34px;

    button {
      margin-left: 16px;
    }
  }

  ::v-deep .v-text-field__slot {
    padding: 0 12px !important;
  }
  .line {
    height: 2px;
    background: $neutral-gray-400;
    margin: 25px 0 auto;
  }

  .btn-edit {
    background-color: $neutral-gray-300;
  }

  .btn-c-sm {
    height: 28px;
    min-width: 28px;
    padding: 0 $spacing-xs;
  }

  // aux
  .nopadding-right {
    padding-right: 0 !important;
    margin-right: 0 !important;
  }

  .nopadding-left {
    padding-left: 0 !important;
    margin-left: 0 !important;
  }
  .col-12 {
    padding: 0 !important;
    margin: 0 !important;
  }
  .col-6 {
    padding-bottom: 0 !important;
    margin-bottom: 20px !important;
  }

  .max-content-width {
    width: max-content;
  }

  // custom autocomplete style
  .c-autocomplete {
    padding-top: 0px;
    margin-top: 0px;
    font-size: 14px;
    line-height: 17px;
    height: 33px;
  }

  .active-automation {
    height: 34px;
    margin-top: 20px !important;
  }

  .switch {
    margin: 5px 0 !important;
    padding: 0px !important;
  }

  ::v-deep .v-messages {
    min-height: 0px !important;
  }

  ::v-deep .c-autocomplete input {
    padding: $spacing-xs;
  }

  ::v-deep .v-autocomplete:not(.v-input--is-focused).v-select--chips input {
    max-height: 25px !important;
    padding: $spacing-xs;
  }

  ::v-deep.v-text-field--outlined > .v-input__control > .v-input__slot {
    min-height: 31px;
    height: 31px;
    line-height: 17px;
    padding: 0;

    fieldset {
      height: 35px;
    }
  }

  ::v-deep .v-input__icon {
    flex: none !important;
  }

  //switch
  ::v-deep .automation_options-enable-switch .v-label {
    font-size: 14px;
    line-height: 17px;
    margin-top: 0;
    padding-top: 0;
    color: $neutral-gray-700;
  }

  ::v-deep .v-input--switch > .v-input__control > .v-input__slot {
    height: 34px;
    padding: 5px 0;
  }

  ::v-deep .v-input--switch__track {
    opacity: 1;
    height: 24px;
    width: 44px;
    top: calc(50% - 12px);
  }

  ::v-deep .v-input--switch__thumb {
    color: white !important;
    caret-color: white !important;
    width: 18px;
    height: 18px;
    top: calc(50% - 9px);
  }

  ::v-deep .c-menu {
    background: #ffffff;
    border: 2px solid $neutral-gray-500;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.06), 0px 4px 6px rgba(0, 0, 0, 0.1);
  }

  ::v-deep.c-autocomplete .v-select__selections {
    max-width: 203px !important;
    min-width: 203px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  ::v-deep.c-autocomplete .v-select__selections input {
    position: absolute !important;
  }

  .text-autocomplete-selected {
    margin-left: 8px !important;
    color: $neutral-gray-800;
  }

  .inputTransactionalList {
    width: 65%;
  }
}
</style>
