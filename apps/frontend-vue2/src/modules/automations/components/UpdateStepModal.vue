<template>
  <div class="w-100 h-100" max-width="100%">
    <div class="form-group">
      <v-dialog
        scrollable
        v-model="dialog"
        :width="step.type == 'conditional' || step.type == 'httpRequest' || step.type == 'trigger' ? '1000' : '700'"
        @click:outside="hideModal"
        @keydown.esc="hideModal"
      >
        <v-card class="modal-card" v-if="step.type">
          <v-card-text>
            <div
              class="div-row div-icon-name justify-space-between"
              :class="'div-icon-name-' + step.type"
              :style="{ '--colorItem': options[step.type].color }"
            >
              <div class="div-row">
                <div class="div-icon">
                  <span class="material-symbols-rounded font-16" v-if="options[step.type].isMaterial">
                    {{ options[step.type].icon }}
                  </span>
                  <img class="img-icon" :src="options[step.type].icon" alt="Icon" v-else />
                </div>
                <span class="ml-4 span-text" :class="`span-name`"> {{ options[step.type].name }} </span>
              </div>
              <div class="div-row gap-10 modal-buttons">
                <a
                  v-if="options[step.type].helpPath"
                  :href="options[step.type].helpPath"
                  class="d-flex align-items-center decoration-none"
                  target="_blank"
                  v-tooltip.top="$t(`button.more`)"
                >
                  <span class="material-symbols-rounded buttons-color font-20"> help </span>
                </a>
                <button class="d-flex" @click="hideModal">
                  <span class="material-symbols-rounded buttons-color"> close </span>
                </button>
              </div>
            </div>
            <div class="mt-4">
              <div v-if="getTags === false && ['addTag', 'removeTag'].includes(step.type)" class="total-align">
                <p class="noData-text-bms">
                  {{ $t('datatable.noTag') }}
                </p>
                <router-link to="/tags/new" class="create-new-bms">
                  <span class="material-icons-round align-center">add</span>
                  Criar tag
                </router-link>
              </div>
              <v-autocomplete
                v-if="
                  getTags === true &&
                  ['addTag', 'email', 'webPush', 'mobilePush', 'sms', 'whatsapp', 'removeTag'].includes(step.type)
                "
                v-model="selectedOptionData"
                item-color="#EBE9E8"
                :elevation="0"
                class="c-autocomplete autocomplete-list"
                :placeholder="selectedTags() > 0 ? '' : $t('input.search')"
                :no-data-text="
                  isLoadingSearch
                    ? $t('input.searching')
                    : searchOptions
                    ? $t('datatable.noData')
                    : ['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'].includes(step.type)
                    ? $t('datatable.noMessages')
                    : $t('datatable.noTags')
                "
                :items="optionsSelect"
                :item-text="
                  ['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'].includes(step.type) ? 'title' : 'name'
                "
                :return-object="true"
                :multiple="['addTag', 'removeTag'].includes(step.type) ? true : false"
                :outlined="false"
                :search-input.sync="searchOptions"
                :loading="isLoadingSearch"
                @click="handleAutocompleteClick()"
                solo
                @focus="isFocused = true"
                @blur="isFocused = false"
                @change="closeModalAndSaveStepData()"
              >
                <template v-if="['addTag', 'removeTag'].includes(step.type)" v-slot:selection="data">
                  <div
                    v-if="data.index === 0"
                    class="gap-5 align-items-center"
                    :class="[searchOptions ? 'd-none' : 'div-row']"
                  >
                    <span class="font-12 text-600 ds-gray-color">
                      {{ $t('input.selected') }}
                    </span>
                    <span class="autocomplete-counter font-12 text-600 d-flex ds-white-color align-items-center">
                      {{ selectedTags() }}
                    </span>
                  </div>
                </template>
              </v-autocomplete>
              <div class="selected-chips" v-if="['addTag', 'removeTag'].includes(step.type)">
                <v-chip
                  v-for="(item, index) in chipTags"
                  :key="`addRemovetag-${index}`"
                  close
                  @click:close="removeSelectedItem(item)"
                >
                  {{ item.name }}
                </v-chip>
              </div>

              <TriggerComponent v-if="step.type == 'trigger'" :render="dialog" :step="step" @updateInfo="updateInfo" />
              <RandomMessageComponent
                v-if="step.type == 'randomMessage' || step.type == 'randomWebPush' || step.type == 'randomMobilePush'"
                :render="dialog"
                :step="step"
                :optionsSelect="optionsSelect"
                @updateInfo="updateInfo"
              />
              <TestABComponent
                v-if="step.type == 'testAB'"
                :render="dialog"
                :step="step"
                :optionsSelect="optionsSelect"
                @updateInfo="updateInfo"
              />
              <WaitComponent v-if="step.type == 'wait'" :render="dialog" :step="step" @updateInfo="updateInfo" />
              <ConditionalComponent
                v-if="step.type == 'conditional'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
              <ConditionalTimeComponent
                v-if="step.type == 'conditionalTime'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
              <CustomFieldComponent
                v-if="step.type == 'updateCustomField'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
              <SplitComponent
                v-if="step.type == 'split'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
                @deletePath="deletePath"
              />
              <HttpRequestComponent
                v-if="step.type == 'httpRequest'"
                :render="dialog"
                :step="step"
                :httpReturn="httpReturn"
                @updateInfo="updateInfo"
                @sendHttpTest="sendHttpTest"
              />
              <ActiveCampaignComponent
                v-if="step.type == 'activeCampaign'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
              <ContactTransferComponent
                v-if="step.type == 'contactTransfer'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
              <RemoveAutomationComponent
                v-if="step.type == 'removeAutomation'"
                :render="dialog"
                :step="step"
                @updateInfo="updateInfo"
              />
            </div>
            <div class="footer-modal div-row justify-space-between align-items-center">
              <ButtonDefault
                v-if="eventType === 'update' && ['trigger', 'end'].includes(step.type) === false"
                @click="confirmDelete"
                data-cy="button-cancel"
                class="button-save btn-cancel font-10 text-600"
                :name="`${$t('button.deleteStep')}`"
              ></ButtonDefault>
              <ButtonDefault
                v-if="showAddButton()"
                :name="eventType === 'update' ? $t('button.save') : $t('sidebar.add')"
                @click="saveStepData"
                class="button-save text-600 font-10 save-position"
                :type="'submit'"
                :disabled="getTags ? false : true"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>
<script lang="ts">
import AutomationsService from '@/modules/automations/services/automations.service';
import MessagesService from '@/modules/messages/services/messages.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import WaitComponent from './UpdateModal/WaitComponent.vue';
import ConditionalTimeComponent from './UpdateModal/ConditionalTimeComponent.vue';
import ModalService from '@/services/modal.service';
import ToastService from '@/services/toast.service';
import ConditionalComponent from './UpdateModal/ConditionalComponent.vue';
import SplitComponent from './UpdateModal/SplitComponent.vue';
import TriggerComponent from './UpdateModal/TriggerComponent.vue';
import HttpRequestComponent from './UpdateModal/HttpRequestComponent.vue';
import CustomFieldComponent from './UpdateModal/CustomFieldComponent.vue';
import TestABComponent from './UpdateModal/TestABComponent.vue';
import ActiveCampaignComponent from './UpdateModal/ActiveCampaignComponent.vue';
import RandomMessageComponent from './UpdateModal/RandomMessageComponent.vue';
import ContactTransferComponent from './UpdateModal/ContactTransferComponent.vue';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { mapState } from 'vuex';
import RemoveAutomationComponent from './UpdateModal/RemoveAutomationComponent.vue';
@Component({
  components: {
    ButtonDefault,
    ConditionalComponent,
    ConditionalTimeComponent,
    SplitComponent,
    TriggerComponent,
    WaitComponent,
    HttpRequestComponent,
    CustomFieldComponent,
    TestABComponent,
    ActiveCampaignComponent,
    RandomMessageComponent,
    ContactTransferComponent,
    RemoveAutomationComponent,
  },
  props: ['dialog', 'step', 'eventType', 'automationSteps'],
})
export default class UpdateStepModal extends Vue {
  private readonly automationService = new AutomationsService();
  private readonly messagesService = new MessagesService();
  private readonly modalService = new ModalService();
  private readonly toastService = new ToastService();

  @Prop() step!: any;
  @Prop() dialog!: boolean;
  @Prop() eventType!: string;
  @Prop() automationSteps!: any;

  options: any = {
    trigger: {
      name: this.$t('button.addTrigger'),
      icon: 'bolt',
      color: '#7b61ff',
      isMaterial: true,
      helpPath: 'https://etusmedia.atlassian.net/wiki/spaces/BHC/pages/1840840705/Entrada+dos+contatos+em+automa+o',
    },
    email: { name: this.$t('button.sendEmail'), icon: 'email', color: '#0057f4', isMaterial: true },
    sms: { name: this.$t('button.sendSms'), icon: 'sms', color: '#0057f4', isMaterial: true },
    whatsapp: { name: this.$t('button.sendWhatsapp'), icon: 'phone', color: '#0057f4', isMaterial: true },
    webPush: {
      name: this.$t('button.webNotification'),
      icon: 'computer',
      color: '#0057f4',
      isMaterial: true,
      key: 'web-push',
    },
    mobilePush: {
      name: this.$t('button.mobilePushNotification'),
      icon: 'smartphone',
      color: '#0057f4',
      isMaterial: true,
      key: 'mobile-push',
    },
    randomMessage: {
      name: this.$t('button.multipleEmails'),
      icon: 'stacked_email',
      color: '#0057f4',
      isMaterial: true,
    },
    randomWebPush: {
      name: this.$t('button.multipleWebPush'),
      icon: 'computer',
      color: '#0057f4',
      isMaterial: true,
    },
    randomMobilePush: {
      name: this.$t('button.multipleMobilePush'),
      icon: 'smartphone',
      color: '#0057f4',
      isMaterial: true,
    },
    wait: { name: this.$t('button.wait'), icon: 'watch_later', color: '#5c5c5c', isMaterial: true },
    addTag: { name: this.$t('button.addTag'), icon: 'shoppingmode', color: '#009BE4', isMaterial: true },
    conditionalTime: { name: this.$t('button.timeCondition'), icon: 'update', color: '#FF9654', isMaterial: true },
    conditional: { name: this.$t('button.conditional'), icon: 'alt_route', color: '#4A004F', isMaterial: true },
    updateCustomField: { name: 'Campo Customizado', icon: 'layers', color: '#076E62', isMaterial: true },
    removeTag: { name: this.$t('button.removeTag'), icon: 'shoppingmode', color: '#f06158', isMaterial: true },
    split: { name: 'Split', icon: 'alt_route', color: '#FFC500', isMaterial: true },
    httpRequest: { name: this.$t('title.httpRequest'), icon: 'language', color: '#7b61ff', isMaterial: true },
    contactValidate: { name: 'Validar email do contato', icon: 'verified', color: '#076E62', isMaterial: true },
    testAB: {
      name: this.$t('title.testCampaign'),
      icon: require('@/assets/campaign_test_ab.svg'),
      color: '#0057f4',
      isMaterial: false,
    },
    activeCampaign: {
      name: 'Active Campaign',
      icon: require('@/assets/active_campaign.svg'),
      color: '#0057f4',
      isMaterial: false,
    },
    contactTransfer: {
      name: this.$t('title.contactTransfer'),
      icon: 'move_up',
      color: '#0031af',
      isMaterial: true,
    },
    removeAutomation: {
      name: this.$t('title.removeAutomation'),
      icon: 'do_not_disturb_on',
      color: '#f5802a',
      isMaterial: true,
    },
  };
  isLoadingSearch = false;
  searchOptions: any = null;
  lastSearch = '';
  selectedOptionData: any = {};
  chipTags: any = [];
  temporarilyArray: any = [];
  optionsSelect: any = [];
  isFocused = false;
  isInitialRequestMade = false;
  getTags: any = false;
  deletedPaths = [] as number[];
  isDeletePath!: boolean;
  httpReturn: any = {};

  async mounted() {
    this.getTags = false;
    this.optionsSelect = await this.findTags();
    this.getTags = this.optionsSelect.length > 0;
    document.addEventListener('keyup', this.processKeyboardEvent);
  }

  hideModal() {
    this.selectedOptionData = this.temporarilyArray;
    this.optionsSelect = [];
    this.selectedOptionData = ['addTag', 'removeTag'].includes(this.step.type) ? [] : {};
    this.lastSearch = '';
    this.isInitialRequestMade = false;
    this.$emit('hideUpdateModal');
  }

  async findMessages(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    this.optionsSelect = [];
    try {
      const response: any = await this.messagesService.getMessages({
        title: search,
        page: 1,
        itemsPerPage: 40,
        type: ['webPush', 'mobilePush'].includes(this.step.type) ? this.options[this.step.type].key : this.step.type,
      });
      return response.data?.results.map((item: any) => {
        return {
          id: item.id,
          title: item.title,
          subject: item.subject,
          name: item.name,
          content: item.content,
          url: item.url,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  async findTags(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.automationService.getTags({
        title: search || '',
        page: 1,
        type: 'tag',
        itemsPerPage: 40,
      });
      return response.data?.results.map((item: any) => {
        return {
          id: item.id,
          name: item.name,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  showAddButton() {
    return !['webPush', 'sms', 'whatsapp', 'email', 'mobilePush'].includes(this.step.type);
  }

  closeModalAndSaveStepData() {
    if (!this.showAddButton()) {
      this.saveStepData();
    }
  }

  saveStepData() {
    const settingsValid = this.validSettings();
    if (!settingsValid) {
      return;
    }

    if (['addTag', 'removeTag'].includes(this.step.type)) {
      this.selectedOptionData = this.chipTags;
    }

    if (this.step.type === 'email') {
      this.selectedOptionData = {
        ...this.selectedOptionData,
        links: this.extractLinks(this.selectedOptionData.content),
      };
      delete this.selectedOptionData.content;
    }

    if (['webPush', 'sms', 'whatsapp'].includes(this.step.type)) {
      this.selectedOptionData = {
        ...this.selectedOptionData,
        links: [this.selectedOptionData.url],
      };
      delete this.selectedOptionData.url;
    }

    if (
      this.step.type === 'testAB' ||
      this.step.type === 'randomMessage' ||
      this.step.type === 'randomWebPush' ||
      this.step.type === 'randomMobilePush'
    ) {
      this.selectedOptionData.messages.forEach((item: any) => {
        item.links = this.extractLinks(item.content);
        delete item.content;
      });
    }

    if (this.isDeletePath) {
      this.$emit('deletePath', this.deletedPaths);
      this.deletedPaths = [];
    }

    this.$emit('saveStepData', this.step.id, this.$props.eventType, {
      type: this.step.type,
      settings: this.selectedOptionData,
    });

    this.hideModal();
  }

  extractLinks(html: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = new Set<string>();

    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && !href.includes('[unsubscribe_link]')) {
        links.add(href);
      }
    });
    return Array.from(links);
  }

  updateInfo(value: any) {
    this.selectedOptionData = value;
  }

  deletePath(index: any, isDeletePath: boolean) {
    this.deletedPaths = index;
    this.isDeletePath = isDeletePath;
  }

  removeStep() {
    this.$emit('saveStepData', this.step.id, 'remove');
  }

  confirmDelete() {
    this.hideModal();
    this.modalService.confirm({
      title: this.$t('button.delete') as string,
      text: this.$t('description.areYouSureDelete') as string,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.removeStep,
    });
  }

  async handleAutocompleteClick() {
    if (this.selectedOptionData && !this.isInitialRequestMade) {
      this.isInitialRequestMade = true;

      if (['addTag', 'removeTag'].includes(this.step.type)) {
        this.optionsSelect = await this.findTags();
      }

      if (['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'].includes(this.step.type)) {
        this.optionsSelect = await this.findMessages();
      }
    }
  }

  @Watch('searchOptions')
  async onSearch(search: string) {
    if (search && search !== this.lastSearch) {
      const data = ['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'].includes(this.step.type)
        ? await this.findMessages(search)
        : await this.findTags(search);
      this.optionsSelect = data;
      this.lastSearch = search;
    }
  }

  @Watch('dialog')
  async showModal() {
    if (this.dialog) {
      if (['addTag', 'email', 'removeTag', 'trigger'].includes(this.step.type)) {
        this.searchOptions = this.step?.settings?.title || this.step?.settings?.name;
      }

      if (['addTag', 'removeTag'].includes(this.step.type)) {
        if (this.step.settings) {
          this.selectedOptionData = Array.isArray(this.step.settings) ? this.step.settings : [this.step.settings];
          return;
        }

        this.selectedOptionData = [];
        return;
      }

      this.selectedOptionData = this.step?.settings || {};
    }
  }

  removeSelectedItem(item: any) {
    const index = this.chipTags.indexOf(item);
    if (index >= 0) {
      this.chipTags.splice(index, 1);
    }
    this.selectedOptionData = this.chipTags;
  }

  selectedTags() {
    if (this.chipTags && Array.isArray(this.chipTags)) {
      return this.chipTags.length;
    }
    return 0;
  }

  validSettings() {
    let error = '';
    switch (this.step.type) {
      case 'trigger':
        if (this.selectedOptionData.type === 'tag') {
          this.automationSteps.child.map((step: any) => {
            if (step.type === 'addTag') {
              const triggerTag = step.settings.map((tag: any) => tag.name);
              if (triggerTag.includes(this.selectedOptionData.name)) {
                error = this.$t('warning.cannotAddSameTriggerTag') as string;
              }
            }
          });
        }
        break;
      case 'addTag':
        const selectedTags = this.selectedOptionData.map((tag: any) => tag.name);
        if (this.automationSteps.type === 'trigger' && this.automationSteps.settings.type === 'tag') {
          const triggerTag = this.automationSteps.settings.name;
          if (selectedTags.includes(triggerTag)) {
            error = this.$t('warning.cannotAddSameTriggerTag') as string;
          }
        }
        break;
      case 'conditionalTime':
        if (parseInt(this.selectedOptionData.initialTime, 10) > parseInt(this.selectedOptionData.endTime, 10)) {
          error = this.$t('warning.initialTimeGreaterThanEndTime') as string;
        }
        break;
      case 'split': {
        const splitSum = Object.values(this.selectedOptionData).reduce((a: any, b: any) => a + b, 0);
        if (splitSum !== 100) {
          error = this.$t('warning.allElementLessThan100') as string;
        }
      }
    }

    if (error) {
      this.toastService.show({
        type: 'error',
        text: error,
        leftBorder: false,
      });
      return false;
    }
    return true;
  }

  async sendHttpTest() {
    try {
      const response = await this.automationService.httpRequestTest(this.selectedOptionData);
      this.toastService.show({
        type: response.data.status < 300 ? 'success' : 'error',
        text: this.$t('toast.sendHttpTest', { status: response.data.status }) as string,
        leftBorder: false,
      });
      this.httpReturn = response.data;
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: error as string,
        leftBorder: false,
      });
    }
  }

  @Watch('selectedOptionData')
  fillChips() {
    if (['addTag', 'removeTag'].includes(this.step.type)) {
      this.chipTags = [];
      this.chipTags = this.chipTags.concat(this.selectedOptionData);
      this.temporarilyArray = this.selectedOptionData;
    }
  }

  processKeyboardEvent(event: KeyboardEvent) {
    if (this.dialog && event.key === 'Enter') {
      this.saveStepData();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep .v-text-field__details {
  display: none;
}
.text-center {
  text-align: center;
}
.v-dialog > .v-card > .v-card__text {
  padding: 20px !important;
  max-height: max-content !important;
}
::v-deep .v-dialog {
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1) !important;
  background: #00000000 !important;
}

::v-deep .v-overlay {
  background-color: $neutral-basic-Black !important;
}

.total-align {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.total-align .noData-text-bms {
  justify-content: center;
  font-size: 14px;
  font-style: italic;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: 0em;
  text-align: center;
  color: $ds-gray-400;
  width: 100%;
}

.total-align .create-new-bms {
  font-size: 10px;
  font-weight: 700;
  line-height: 10px;
  letter-spacing: 0.07em;
  text-align: center;
  border-radius: 28px;
  padding: 6px 8px;
  gap: 8px;
  max-width: 120px;
  max-height: 24px;
  text-decoration: none;
  text-transform: uppercase;
  color: $neutral-basic-white;
  background-color: $ds-blue;
  display: flex;
  align-items: center;
  margin: 0 auto;
  &:hover {
    background-color: $ds-blue-dark;
  }
}

.c-autocomplete ::v-deep .v-input__slot {
  margin-bottom: -10px !important;
  border: none !important;
  box-shadow: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  height: 36px !important;
  border-radius: 8px !important;
}

.c-autocomplete ::v-deep .v-autocomplete__content {
  margin-top: -1 !important;
  top: 100% !important;
  border-top: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  border-radius: 0px 0px 8px 8px !important;
  box-shadow: none !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-input__slot {
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 0px solid $ds-gray-300 !important;
  border-radius: 8px 8px 0px 0px !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-menu__content {
  border: 1px solid $ds-blue !important;
  border-top: none !important;
  border-radius: 0 0 8px 8px !important;
}

.c-autocomplete ::v-deep .v-list-item__action {
  display: none !important;
}
.selected-items-bms {
  position: absolute;
  left: 30px;
  top: 62px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0em;
  text-align: left;
  color: $ds-gray;
  z-index: 1;
  & .circle-count-bms {
    width: 18px;
    height: 18px;
    font-size: 10px;
    font-weight: 600;
    line-height: 10px;
    letter-spacing: 0em;
    text-align: left;
    color: $neutral-basic-white;
    border-radius: 20px;
    padding: 4px 6px 4px 6px;
    background-color: $ds-blue;
  }
}
.selected-chips ::v-deep .v-chip {
  margin-right: 8px;
  margin-bottom: 8px;
  background: $neutral-basic-white;
  height: 24px;
  border-radius: 20px;
  padding: 12px 16px 12px 16px;
  border: 1px solid $ds-gray-300;
}
::v-deep .v-input {
  border: none;
}
.div-icon {
  width: 24px;
  height: 24px;
  border-radius: 12px;
  margin-left: -14px;
  background-color: var(--colorItem);
  display: flex;
  justify-content: center;
  justify-items: center;
  z-index: 100;
  position: fixed;

  > span {
    color: white;
    align-self: center;
  }
}

.div-icon-name {
  margin-left: -15px;
  align-items: center;
  background: white;
}
.span-text {
  font-weight: 600;
  font-size: 17px;
  margin-top: 5px;
}

.buttons-color {
  color: #a6a6a6;
  &:hover {
    color: $ds-gray;
  }
}
.modal-card {
  border: 0.5px solid ds-gray-300 !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.span-name {
  color: var(--colorItem);
}
.img-icon {
  height: 14px;
  width: 14px;
  filter: invert(100%) sepia(94%) saturate(20%) hue-rotate(245deg) brightness(164%) contrast(100%);
  align-self: center;
}

.close-button {
  color: $ds-gray-400;
  margin-top: -10px;
  margin-right: -10px;
}

.btn-cancel {
  color: $ds-red !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-red;
}

.btn-cancel:hover {
  background-color: #ffffff !important;
}
.button-save {
  max-height: 26px !important;
  min-width: fit-content !important;
  max-width: fit-content !important;
  padding: 4px 12px 4px 12px !important;
  box-shadow: none !important;
  letter-spacing: 0.07em;
}

.save-position {
  margin-left: auto;
}

.cancel-button {
  text-transform: uppercase;
}

.footer-modal {
  margin-top: 24px;
}

.autocomplete-counter {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background-color: $ds-blue;
  justify-content: center;
}

::v-deep.v-menu__content.theme--light.v-menu__content--fixed.menuable__content__active.v-autocomplete__content {
  max-height: 260px !important;
}
</style>
