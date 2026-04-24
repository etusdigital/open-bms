<template>
  <div class="col-12">
    <v-card class="background-card mt-0">
      <div class="col-12 contact-data div-row">
        <div
          :class="{ 'full-size': currentState === 'contactsSent' || currentState === 'sendingContacts' }"
          class="cursor-pointer drop-actions"
        >
          <div v-if="currentState === 'empty'">
            <div
              :class="['dropZone dash-blue', dragging ? 'dropZone-over' : '']"
              @dragenter="dragging = true"
              @dragleave="dragging = false"
              @drag="onChange"
            >
              <img src="@/assets/import-contact-file.svg" alt="Select a file" />
              <span class="dropZone-title mt-4">{{ $t('title.uploadFile') }}</span>
              <span class="dropZone-title-drag mt-2">{{ $t('title.dragDrop') }}</span>

              <input class="file-drag" type="file" ref="inputFile" @change="onChange" />
            </div>
          </div>

          <div v-if="currentState === 'loadedFile'" class="dropZone dash-green">
            <img src="@/assets/import-contact-file.svg" alt="Loaded File" />
            <div class="dropZone-file-title mt-3">
              <span class="dropZone-title file-title">{{ file.name }}</span>
              <button type="button" @click="removeFile">
                <span class="material-symbols-rounded delete-file">delete</span>
              </button>
            </div>
            <span class="dropZone-title-drag mt-2"
              >{{ contactsTotal | formatNumber }} {{ $t('title.foundedContacts') }}</span
            >
          </div>

          <div v-if="currentState === 'sendingContacts'" class="dropZone dash-grey">
            <v-progress-circular indeterminate class="dropZone-title"></v-progress-circular>
            <span class="dropZone-title-drag mt-2">{{ $t('button.sending') }}</span>
          </div>

          <div v-if="currentState === 'contactsSent'" class="dropZone dash-green">
            <img src="@/assets/import-finished.svg" alt="Upload finished" />
            <span class="dropZone-title file-title mt-4">{{ file.name }}</span>
            <span class="dropZone-title-drag mt-2"
              >{{ contactsTotal | formatNumber }} {{ $t('create.importedContacts') }}</span
            >
            <div class="count-title mt-2">
              <span class="dropZone-title cursor-pointer mt-1" @click="$router.push('/contacts')">
                <span class="material-symbols-rounded back-icon font-12">undo</span>
                {{ $t('title.backContacts') }} {{ $t('title.seconds', { count: timerCountdown }) }}</span
              >
            </div>
          </div>
        </div>
        <div
          :class="{ 'drop-actions-sent': currentState === 'contactsSent' || currentState === 'sendingContacts' }"
          class="drop-actions"
        >
          <label class="label-title-all label-tags label-color mb-1">{{ $t('title.associateTags') }}</label>
          <v-menu
            :disabled="currentState === 'sendingContacts'"
            ref="menu"
            v-model="menu"
            bottom
            class="tag-menu"
            :close-on-content-click="false"
          >
            <template v-slot:activator="{ on }">
              <div class="menu-tags cursor-pointer" v-on="on">
                <input class="input-tag" type="button" :value="`${$t('input.select')}`" />
                <span class="material-symbols-rounded ds-gray-color font-20" medium>arrow_drop_down</span>
              </div>
            </template>
            <v-card class="tag-card">
              <div class="div-row align-items-center search-bar-select">
                <input
                  id="header-menu__campaigns-search"
                  class="search-input"
                  type="text"
                  :placeholder="`${$t('input.find')}`"
                  @input="getTags($event.target.value)"
                />
                <span class="material-symbols-rounded ds-blue-color"> search </span>
              </div>
              <div class="tag-list">
                <div class="checkbox-tag pl-2" :key="`tags-modal-filter-${i}`" v-for="(tags, i) in tagsFormatted">
                  <div class="custom-checkbox">
                    <input
                      type="checkbox"
                      :key="`search-input-tags-${i}`"
                      :id="`tag-options-${tags.id}`"
                      v-model="newTags"
                      :value="{ ...tags }"
                      class="input-filters"
                    />
                    <label class="label-filters" :for="`tag-options-${tags.id}`" :key="`tag-labels-${i}`">
                      {{ tags.name }}
                    </label>
                  </div>
                </div>
              </div>
            </v-card>
          </v-menu>
          <div v-if="newTags.length > 0" class="chips-tag">
            <div
              class="md-chips filters-chips-tags"
              :key="`chip-${index}`"
              v-for="(chip, index) in newTags"
              :title="chip.name"
            >
              <p>{{ chip.name }}</p>
              <button
                class="material-symbols-rounded icon-chips-tags font-16"
                :disabled="currentState === 'sendingContacts'"
                type="button"
                @click="removeTag(chip.id)"
              >
                close
              </button>
            </div>
          </div>
          <div class="select-slot div-column">
            <label class="label-title-all label-tags label-color mb-1">{{ $t('datatable.actions') }}</label>

            <div class="custom-checkbox checkbox-actions" v-for="action in contactsActions" :key="action.value">
              <input
                type="checkbox"
                :id="`actions-options-${action.value}`"
                v-model="selectedAction"
                :value="action"
                :disabled="action.isLargeFile && contactsFile.length > 10000"
                class="input-filters"
              />
              <label
                :disabled="action.isLargeFile && contactsFile.length > 10000"
                class="label-filters"
                :for="`actions-options-${action.value}`"
              >
                {{ action.name }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <div v-if="currentState === 'loadedFile'">
      <span class="ds-gray-color cards-outside-label label-title">{{ $t('create.associateFields') }}</span>
      <v-card class="background-card mt-2">
        <div class="col-12 mt-1 div-column">
          <div class="div-column">
            <div class="div-row csv-label-fields">
              <span class="ds-gray-color label-sub-title">{{ $t('create.mapFields') }}</span>
              <span class="ds-gray-color label-sub-title">{{
                $t('datatable.csvTotal', {
                  showing: 3,
                  total: formatedTotalNumber,
                })
              }}</span>
            </div>
            <div class="div-row check-csv mt-3 custom-checkbox">
              <input type="checkbox" id="csvHeader" v-model="isHeader" class="input-filters" />
              <label for="csvHeader" class="label-sub-title cursor-pointer mb-0">
                {{ $t('input.csvHeaderToggle') }}
              </label>
            </div>
          </div>
          <div class="contacts-fields" v-if="contactsColumns">
            <table>
              <thead>
                <tr>
                  <th v-for="selectIndex in contactsColumns" :key="`selects-${selectIndex}`">
                    <select
                      @change="setColumn($event.target.value, selectIndex)"
                      class="select-column-name label-sub-title mb-3"
                      :class="{
                        'width-min': contactsColumns <= 6,
                        'color-unmap': checkSelect(selectIndex),
                      }"
                    >
                      <option selected disabled value="">{{ $t('input.select') }}</option>
                      <option
                        v-for="(column, columnIndex) in csvColumns.ignore"
                        :value="column.value"
                        :key="`selectOption-${selectIndex}-ignore-${columnIndex}`"
                      >
                        {{ column.name }}
                      </option>
                      <optgroup :label="`${$t('title.contactInfo')}`">
                        <option
                          v-for="(column, columnIndex) in csvColumns.contact"
                          :disabled="checkOptionSelected(column.value, selectIndex)"
                          :value="column.value"
                          :key="`selectOption-${selectIndex}-contact-${columnIndex}`"
                        >
                          {{ column.name }}
                        </option>
                      </optgroup>
                      <optgroup :label="`${$t('sidebar.customFields')}`" v-if="csvColumns.customFields.length > 0">
                        <option
                          v-for="(column, columnIndex) in csvColumns.customFields"
                          :disabled="checkOptionSelected(column.value, selectIndex)"
                          :value="column.value"
                          :key="`selectOption-${selectIndex}-customfields-${columnIndex}`"
                        >
                          {{ column.name }}
                        </option>
                      </optgroup>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody :class="{ 'table-contacts-on': isHeader === true, 'table-contacts-off': isHeader === false }">
                <tr
                  class="contacts-rows"
                  v-for="(item, index) in contactsFile.slice(0, 4)"
                  :key="`contact-line-${index}`"
                >
                  <td
                    class="label-sub-title"
                    v-for="(line, lineIndex) in item"
                    :key="`contact-line-${lineIndex}`"
                    :title="line"
                  >
                    {{ line }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </v-card>
    </div>

    <AlertComponent
      v-if="contactsColumns >= 1 && contactsFile.length >= 1 && currentState === 'loadedFile'"
      :type="`${headersTotal >= contactsColumns ? 'success' : 'warning'}`"
      :showIcon="true"
      >{{
        isHeaderMapped
          ? $t(contactsHeaders.length !== 1 ? 'alert.reviewPlural' : 'alert.reviewSingle', { columns: headersTotal })
          : $t('alert.importAll')
      }}</AlertComponent
    >

    <div v-if="currentState !== 'contactsSent'" class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/contacts')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="`${$t('button.upload')}`"
        :disabled="['empty', 'sendingContacts'].includes(currentState)"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
        @click="uploadContacts"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { ContactsImportDto } from '@/modules/contacts/dto/contacts-import.dto';
import ContactsService from '../services/contacts.service';
import TagService from '@/modules/tags/services/tag.service';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import { CustomFieldsDto } from '@/modules/customfields/dtos/customFieldsdto';
import CustomFieldsService from '@/modules/customfields/services/customFields.service';
import AlertComponent from '@/components/alert/AlertComponent.vue';
import Papa from 'papaparse';

@Component({
  components: { InputDefault, ButtonDefault, AlertComponent },
})
export default class ContactsImport extends Vue {
  private readonly contactsService = new ContactsService();
  private readonly toastService = new ToastService();
  private readonly tagService = new TagService();
  private readonly customFieldsService = new CustomFieldsService();
  public tags: Array<TagDto> = new Array<TagDto>();
  public customFields: Array<CustomFieldsDto> = new Array<CustomFieldsDto>();
  public newTags: any = [];
  public contactsActions: any = [
    { name: this.$t('input.validateContacts') as string, value: 'contactValidate', isLargeFile: true },
    { name: this.$t('input.updateContacts') as string, value: 'contactUpdate', isLargeFile: false },
    { name: this.$t('input.iniciateAutomation') as string, value: 'startAutomation', isLargeFile: true },
  ];

  contactsTotal = 0;
  contactsFile: ContactsImportDto[] = [];
  name!: string;
  file: File | null = null;
  size: any = [];
  dragging = false;
  currentState = 'empty';
  timerCountdown = 10;
  csvColumns: any = {
    ignore: [{ name: this.$t('title.ignore') as string, value: JSON.stringify({ type: 'ignore', value: 'ignore' }) }],
    contact: [
      { name: this.$t('title.fullName') as string, value: JSON.stringify({ type: 'contacts', value: 'fullName' }) },
      { name: this.$t('title.firstName') as string, value: JSON.stringify({ type: 'contacts', value: 'firstName' }) },
      { name: this.$t('title.lastName') as string, value: JSON.stringify({ type: 'contacts', value: 'lastName' }) },
      { name: this.$t('title.email') as string, value: JSON.stringify({ type: 'contacts', value: 'email' }) },
      { name: this.$t('title.phone') as string, value: JSON.stringify({ type: 'contacts', value: 'phone' }) },
      { name: 'WhatsApp', value: JSON.stringify({ type: 'contacts', value: 'whatsapp' }) },
      { name: this.$t('title.city') as string, value: JSON.stringify({ type: 'contacts', value: 'city' }) },
      { name: this.$t('title.region') as string, value: JSON.stringify({ type: 'contacts', value: 'region' }) },
      { name: this.$t('title.country') as string, value: JSON.stringify({ type: 'contacts', value: 'country' }) },
      { name: this.$t('title.postal') as string, value: JSON.stringify({ type: 'contacts', value: 'postal' }) },
      { name: this.$t('title.timezone') as string, value: JSON.stringify({ type: 'contacts', value: 'timezone' }) },
      { name: 'Ip', value: JSON.stringify({ type: 'contacts', value: 'ip' }) },
    ],
    customFields: [],
  };
  contactsResults = [];
  contactsColumns = 0;
  contactsHeaders: any = {};
  tagsFormatted: any = [];
  menu = false;
  actionsMenu = false;
  selectedAction: any = [];
  isHeader = false;
  isHeaderMapped = false;

  async beforeMount() {
    this.timerCountdown = 10;
    await this.getTags('');
    await this.getCustomFields('');
  }

  beforeDestroy() {
    this.timerCountdown = 0;
  }

  get formatedTotalNumber() {
    return Vue.filter('formatNumber')(this.contactsTotal);
  }

  get headersTotal() {
    return Object.keys(this.contactsHeaders).length;
  }

  get hasCommunicationColumn() {
    const headersArray = Array.from(Object.values(this.contactsHeaders));
    return headersArray.find(
      (column: any) => column.type === 'contacts' && ['email', 'whatsapp', 'phone'].includes(column.value)
    );
  }

  countDown() {
    if (this.timerCountdown > 0) {
      setTimeout(() => {
        this.timerCountdown--;
        this.countDown();
      }, 1000);
    } else {
      this.$router.push({ path: '/contacts' });
    }
  }

  onChange(e: { target: { files: any }; dataTransfer: { files: any } }) {
    const files = e.target.files || e.dataTransfer.files;

    if (!files.length) {
      this.dragging = false;
      return;
    }

    this.createFile(files[0]);
  }

  async createFile(file: File) {
    this.dragging = false;
    if (!file.type.match(/csv|text\/plain/)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.csvFile') as string,
      });
      return;
    }

    if (file.size > 50000000) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.fileSize') as string,
      });
      return;
    }

    this.file = file;
    try {
      this.contactsFile = await this.parseFile(file);
      this.getHeaderRow(this.contactsFile);
      this.contactsColumns = Object.keys(this.contactsFile[0]).length;
    } catch (error) {
      console.log('Log - error', error);
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.contactsImportInvalidContent') as string,
      });
      (this.$refs.inputFile as HTMLInputElement).value = '';
      this.removeFile();
      return;
    }
    this.contactsTotal = this.contactsFile.length;
    if (this.contactsFile.length > 10000) {
      this.selectedAction = [];
    }
    this.currentState = 'loadedFile';
    this.checkHeaders();
  }
  @Watch('isHeader')
  checkTotal() {
    if (this.isHeader === true) {
      this.contactsTotal = this.contactsFile.length - 1;
    } else {
      this.contactsTotal = this.contactsFile.length;
    }
  }

  @Watch('headersTotal')
  checkHeaders() {
    if (this.headersTotal < this.contactsColumns) {
      this.isHeaderMapped = true;
    } else {
      this.isHeaderMapped = false;
    }
  }

  removeFile() {
    this.file = null;
    this.dragging = false;
    this.contactsTotal = 0;
    this.currentState = 'empty';
    this.contactsHeaders = [];
    this.contactsFile = [];
    this.contactsColumns = 0;
    if (this.isHeader === true) {
      this.isHeader = false;
    }
  }

  getHeaderRow(orginalValues: Array<any>) {
    const values = [...orginalValues];
    const fieldsHeader = this.csvColumns.contact.map((field: any) => {
      return JSON.parse(field.value).value;
    });
    const firstLine = values[0];
    const hasColumns = firstLine.filter((column: string) => {
      const columnFilter = column.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return fieldsHeader.includes(columnFilter);
    });
    if (hasColumns.length > 0) {
      this.isHeader = true;
    }
  }

  async uploadContacts(): Promise<void> {
    try {
      if (this.headersTotal === 0) {
        return this.toastService.show({
          type: 'error',
          text: this.$t('toast.mapColumn') as string,
        });
      }

      if (!this.hasCommunicationColumn) {
        return this.toastService.show({
          type: 'error',
          text: this.$t('toast.mapCommunicationColumn') as string,
        });
      }

      if (this.isHeader === true) {
        this.contactsFile.shift();
      }

      this.currentState = 'sendingContacts';

      const actions: any = {};
      this.contactsActions.forEach((action: any) => {
        const selected = this.selectedAction.find((actionSelected: any) => actionSelected.value === action.value);
        actions[action.value] = selected ? true : false;
      });

      let response;
      const tags = this.newTags.map((tag: any) => tag.name);
      const chunkSize = 50000;
      for (let i = 0; i < this.contactsFile.length; i += chunkSize) {
        const batch = this.contactsFile.slice(i, i + chunkSize);
        response = await this.contactsService.importContacts({
          contacts: batch,
          headers: this.contactsHeaders,
          tags,
          actions,
        });
      }

      if (response) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.contactsSaved') as string,
        });
        this.currentState = 'contactsSent';
        this.countDown();
      }
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.errorContacts') as string,
      });
    }
  }

  parseFile(file: File): Promise<ContactsImportDto[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);

      reader.onloadend = (e: any) => {
        const content = e.target.result;
        const result = Papa.parse(content, { skipEmptyLines: true });
        resolve(result.data as ContactsImportDto[]);
      };

      reader.onerror = (e: any) => {
        reject(e);
      };
    });
  }

  async getTags(value: string) {
    try {
      const result = await this.tagService.getTags({
        title: value,
        itemsPerPage: 100,
        page: 1,
        type: 'tag',
      });
      this.tags = result?.data?.results;
      this.parseTags();
    } catch (err) {
      console.error(err);
    }
  }

  parseTags() {
    this.tagsFormatted = this.tags.map((tag: any) => {
      return {
        id: tag.id,
        name: tag.name,
      };
    });
  }

  async getCustomFields(value: string) {
    try {
      const result = await this.customFieldsService.getCustomFields({
        title: value,
        itemsPerPage: 100,
        page: 1,
      });
      this.customFields = result?.data?.results;

      this.customFields.forEach((customField: any) => {
        this.csvColumns.customFields.push({
          name: customField.name,
          value: JSON.stringify({ type: 'customField', value: customField.name }),
        });
      });
    } catch (err) {
      console.error(err);
    }
  }
  removeTag(id: number) {
    this.newTags = this.newTags.filter((tag: any) => tag.id !== id);
  }

  removeAction(value: number) {
    this.selectedAction = this.selectedAction.filter((action: any) => action.value !== value);
  }

  setColumn(value: any, index: number) {
    this.contactsHeaders = { ...this.contactsHeaders, [index - 1]: JSON.parse(value) };
  }

  checkOptionSelected(value: string, index: number) {
    value = JSON.parse(value)?.value || '';
    const filterOption = Object.keys(this.contactsHeaders).find((key) => this.contactsHeaders[key].value === value);
    return filterOption && parseInt(filterOption, 10) !== index - 1 ? true : false;
  }

  checkSelect(index: number) {
    const selectOption = this.contactsHeaders.hasOwnProperty(index - 1);
    return selectOption ? false : true;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.file-import {
  border: 1px dashed $ds-blue;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.dropZone {
  height: 264px;
  padding: 70px 0;
  justify-content: center;
  display: flex;
  align-items: center;
  flex-direction: column;
  outline: 1px dashed $ds-blue;
  border-radius: 4px;
  transition:
    margin 0.15s ease-in-out,
    height 0.15s ease-in-out,
    background-color 0.15s linear;
}

.dash-blue:hover .dropZone-title {
  color: #a6a6a6;
}

.dash-green {
  outline-color: $ds-green;
}

.dash-grey {
  outline-color: #a6a6a6;
}

.count-title .dropZone-title:hover {
  color: #a6a6a6;
}

.count-title .dropZone-title .back-icon {
  color: $ds-blue !important;
}

.count-title .dropZone-title:hover .back-icon {
  color: #a6a6a6 !important;
}

.delete-file {
  font-size: 18px;
  color: $ds-gray-300;
  line-height: 0;
}

.delete-file:hover {
  color: #a6a6a6;
}

.dropZone-title {
  color: $ds-blue;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  flex-direction: row;
  line-height: 1em;
}

.dropZone-file-title {
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 1em;
}

.file-title {
  text-transform: uppercase;
}

.dropZone-title-drag {
  color: $ds-gray;
  font-weight: 700;
  font-size: 12px;
  line-height: 1em;
}

.dropZone input {
  cursor: pointer !important;
  top: 0px;
  right: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  height: 100%;
  opacity: 0;
  position: absolute;
}

.dropZone-upload-limit-info {
  display: flex;
  justify-content: flex-start;
  flex-direction: column;
}

.dropZone-over {
  margin: 10px;
  height: 244px;
  background-color: #f4f8ff;
  border-radius: 8px;
}

.select-column-name {
  border-radius: 8px;
  height: 36px;
  border: 1px solid $ds-gray-300;
  padding: 0px 10px 0px 5px !important;
  width: 180px;
  outline: none;
  appearance: auto;

  &:focus-visible {
    outline-offset: 2px;
    outline-width: 2px;
    outline-style: solid;
    outline-color: $ds-blue;
  }
}

.width-min {
  width: -webkit-fill-available !important;
}

::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  border: 1px solid $ds-gray-300;
  box-shadow: none !important;
}

.contacts-fields {
  padding: 10px 4px;
  overflow-x: auto;
  overflow-y: hidden;

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;

    th {
      width: 210px;
      max-width: 210px;
      border-right: 32px solid transparent;
    }

    td {
      width: 210px;
      max-width: 210px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-right: 32px solid transparent;
    }

    th:last-child,
    td:last-child {
      border-right: none; /* Remove the right border from the last column */
    }
  }
}

::-webkit-scrollbar {
  height: 8px !important;
}

table {
  margin-bottom: -1px;
}

.contacts-rows {
  border-bottom: 1px solid $ds-gray-300;
  height: 45px;
}

::v-deep.v-text-field.v-text-field--solo .v-label {
  font-size: 12px !important;
}

.contact-data {
  gap: 20px;
}

.tag-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 999;
}

.menu-tags {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  min-height: 36px !important;
  border-radius: 8px;
  color: $ds-gray-300;
  cursor: default;
}

.input-tag {
  font-size: 12px;
  font-weight: 400;
  color: $ds-gray;
}

.tag-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}

.search-bar-select {
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  padding-right: 12px;
  padding-left: 12px;
  overflow: hidden;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.tag-list {
  max-height: 9em;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-tag {
  position: relative;
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
}

.checkbox-actions {
  position: relative;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 220px;
  display: block;
  overflow: hidden;
  margin: 0 0 0 8px !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.drop-actions {
  width: 50%;
}

.full-size {
  width: 100% !important;
}

.drop-actions-sent {
  display: none;
}

.chips-tag {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  gap: 0.5em;
  padding-top: 8px;
  min-inline-size: fit-content;
  grid-auto-rows: min-content;
}

.chips-action {
  display: flex;
  gap: 0.5em;
  padding-top: 8px;
  min-inline-size: fit-content;
}

.filters-chips-color {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  letter-spacing: 0.7px;
  display: flex;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  justify-content: space-between;
  padding-right: 6px;
  gap: 10px;
}

.filters-chips-tags {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  letter-spacing: 0.7px;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  display: grid;
  grid-template-columns: 18fr 1fr;
  padding: 0 8px;
  gap: 8px;
}

.filters-chips-tags > p {
  margin-top: 1em;
  line-height: 1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  grid-template-columns: inherit;
}

.actions > span {
  overflow: hidden;
  text-overflow: clip;
}

.icon-chips-tags {
  color: $ds-gray;
  margin-top: -3px;
  &:hover {
    color: $ds-gray-400;
  }
}

.select-slot {
  margin-top: 15px;
}

.actions-select {
  border-radius: 8px !important;
  height: 36px !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  padding-left: 9px;
  padding-right: 12px;
  border: 1px solid $ds-gray-300 !important;
  color: $ds-gray;
  outline: none;
  -webkit-appearance: auto;
}

select.actions-select:focus {
  border: 1px solid $ds-blue !important;
}

.csv-label-fields {
  justify-content: space-between;
}

.check-csv {
  position: relative;
  display: flex;
  align-items: center;
}

.switch-header {
  margin-top: 0px;
  padding-top: 0px;
}

tbody.table-contacts-off > tr:first-child {
  opacity: 1;
  height: 45px;
  line-height: 1.5;
  transition: all 0.3s ease-in-out;
}

tbody.table-contacts-on > tr:first-child {
  opacity: 0;
  line-height: 0;
  height: 0px;
  transition: all 0.3s ease-in-out;
}

.dropZone-title ~ .dropZone-title-drag ~ .file-drag:hover {
  text-decoration: none !important;
}

.actions-selected {
  width: 120px;
  font-size: 10px;
  letter-spacing: 0.7px;
  height: 20px;
  background-color: $ds-gray-100;
  color: $ds-gray;
  border-radius: 20px;
  padding: 0px 15px 0px 15px;
  overflow: hidden;
  font-weight: 600;
  line-height: 2;
}

.label-disable {
  color: $ds-gray-300 !important;
  cursor: default;
  display: flex;
  align-items: center;
}

::placeholder {
  color: $ds-gray-300 !important;
}

.color-unmap {
  border: 1px solid #ffc500;
  background-color: #fffdef;
}
.label-filters[disabled] {
  color: $neutral-gray-500;
}
</style>
