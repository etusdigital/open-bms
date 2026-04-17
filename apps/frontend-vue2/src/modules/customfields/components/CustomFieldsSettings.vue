<template>
  <div class="div-column label-placeholder-wrapper">
    <div class="gap-16 label-placeholder">
      <div v-for="group in filteredSelects()" :key="group.type" class="div-column gap-5">
        <span class="ds-gray-color font-12 text-600">{{ group.label }}</span>
        <select
          class="settings-select font-12 text-400 ds-gray-color"
          v-model="selectedValues"
          @input="updateInput($event.target.value, 'fieldFormat')"
        >
          <option value="" selected hidden>{{ group.placeholder }}</option>
          <option
            v-for="(option, optionIndex) in group.options"
            :key="optionIndex"
            :value="option.value"
            class="font-12 text-400 ds-gray-color"
          >
            {{ option.title }}
          </option>
        </select>
      </div>
      <div class="div-column gap-5" v-if="customType === 'list'">
        <span class="ds-gray-color font-12 text-600">{{ $t('input.fieldRenderType') }}</span>
        <select
          class="settings-select font-12 text-400 ds-gray-color"
          v-model="selectedRenderType"
          :disabled="!selectedValues"
          @input="updateInput($event.target.value, 'fieldType')"
        >
          <option v-for="item in filteredTypes()" :value="item.value" :key="item.name">
            {{ item.name }}
          </option>
        </select>
      </div>
      <div class="div-column" v-if="customType === 'file'">
        <label class="mb-1 text-600 font-12 ds-gray-color">{{ $t('input.fileFormat') }}</label>
        <v-menu
          ref="menu"
          v-model="showMenu"
          class="select-menu div-row"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
        >
          <template v-slot:activator="{ on }">
            <v-btn
              class="div-row justify-space-between button-file input-text-create pl-2 pr-2"
              :class="{ 'select-button-open': showMenu }"
              v-on="on"
              @click="showMenu = true"
            >
              <div class="div-row gap-5 align-items-center">
                <span class="font-12 text-400 button-text ds-gray-color">{{ $t('input.selectFile') }}</span>
                <span v-if="selectedFileTypes.length" class="formats-selected ds-gray-color font-12 text-600">
                  {{ selectedFileTypes.length }}
                </span>
              </div>
              <div>
                <span
                  class="material-symbols-rounded font-20"
                  :class="{ 'ds-blue-color open-menu': showMenu === true }"
                  dense
                  >arrow_drop_down</span
                >
              </div>
            </v-btn>
          </template>
          <v-card :class="{ 'select-card-open': showMenu }">
            <div
              class="div-row align-items-center w-100 file-types gap-5"
              :key="`select-files-${index}`"
              v-for="(item, index) in fileTypes"
            >
              <input
                type="checkbox"
                :id="`file-select-${item.title}`"
                :key="`select-file-${index}`"
                :value="item.title"
                class="cursor-pointer d-flex ds-gray-color input-check"
                v-model="selectedFileTypes"
              />
              <label
                class="d-flex text-uppercase mb-0 text-400 font-12 cursor-pointer w-100 ds-gray-color"
                :for="`file-select-${item.title}`"
                :key="`file-labels-${index}`"
              >
                {{ item.title }}
              </label>
            </div>
          </v-card>
        </v-menu>
      </div>
      <div class="div-column">
        <div class="div-row justify-space-between">
          <label class="font-12 text-600 ds-gray-color mb-1" for="label">Label</label>
          <span class="font-10 ds-lighter-gray-color text-400 mb-0">{{ label.length }}/40</span>
        </div>
        <input
          class="input-text-create pl-2 font-12"
          type="text"
          maxlength="255"
          id="label"
          v-model="label"
          :placeholder="`${$t('input.typeLabel')}`"
          @input="updateInput($event.target.value, 'label')"
        />
      </div>
      <div class="div-column">
        <div class="div-row justify-space-between">
          <label class="font-12 text-600 ds-gray-color mb-1" for="placeholder">Placeholder</label>
          <span class="font-10 ds-lighter-gray-color text-400 mb-0">{{ placeholder.length }}/40</span>
        </div>
        <input
          class="input-text-create pl-2 font-12"
          :class="{ 'disabled-input': selectedRenderType !== 'dropdown' && customType === 'list' }"
          type="text"
          maxlength="255"
          id="placeholder"
          v-model="placeholder"
          :placeholder="`${$t('input.typePlaceholder')}`"
          :disabled="selectedRenderType !== 'dropdown' && customType === 'list'"
          @input="updateInput($event.target.value, 'placeholder')"
        />
      </div>
      <div v-if="customType === 'number' || customType === 'text'" class="div-column">
        <label class="d-flex mb-1 text-600 font-12 ds-gray-color">
          {{ $t('input.mask') }}
        </label>
        <input
          class="input-text-create pl-2 font-12"
          type="text"
          maxlength="40"
          id="mask"
          v-model="mask"
          :placeholder="`${$t('input.typeMask')}`"
          @input="updateInput($event.target.value, 'mask')"
        />
        <a
          href="https://etusmedia.atlassian.net/wiki/spaces/BHC/pages/1802862615/O+que+s+o+m+scaras+e+como+criar"
          target="_blank"
          class="configure-link d-flex text-uppercase text-700 font-10 ds-blue-color cursor-pointer"
        >
          {{ $t('input.learnConfigure') }}
        </a>
      </div>
      <div class="div-column" v-if="customType === 'list'">
        <label class="mb-1 ds-gray-color text-600 font-12">{{ $t('input.options') }}</label>
        <div class="div-column gap-8 item-grab">
          <div
            v-for="(option, optionIndex) in listOptions"
            :key="'list-options' + optionIndex"
            class="div-row items-active gap-8"
            :draggable="true"
            @dragstart="dragStart($event, option, optionIndex)"
            @dragover.prevent
            @drop="drop($event, optionIndex)"
          >
            <div class="d-flex align-items-center drag-handle">
              <span class="material-symbols-rounded ds-light-gray-color">drag_indicator</span>
            </div>
            <input
              type="text"
              :placeholder="`${$t('input.typeHere')}`"
              :value="option"
              id="youridhere"
              class="input-option font-12"
              @input="createOption(optionIndex, $event.target.value)"
            />
            <button
              class="cursor-pointer"
              @click="removeOption(optionIndex)"
              type="button"
              style="z-index: 10"
              v-if="listOptions.length > 1"
            >
              <span class="material-symbols-rounded ds-light-gray-color trash-can-icon">delete</span>
            </button>
          </div>
        </div>
        <button class="add-option mb-2 mt-2 d-flex align-items-center text-600 font-12" @click="addOption()">
          <span class="material-symbols-rounded"> add </span>
          {{ $t('sidebar.add') }}
        </button>
      </div>
      <div v-for="(character, characterIndex) in filteredCharacters()" :key="characterIndex" class="div-column">
        <span class="font-12 text-600 pb-1 ds-gray-color">{{ character.label }}</span>
        <div class="div-row align-items-center">
          <input
            class="input-number font-14 pl-2 input-size ds-gray-color"
            type="number"
            id="endingNumber"
            v-model="character.value"
            @input="updateInput($event.target.value, character.key)"
          />
          <div class="div-column">
            <button
              class="button-number d-flex align-items-center"
              type="button"
              v-on:click.prevent="updateCharacterValue(character, 1)"
            >
              <span class="material-symbols-rounded icon-up" medium>arrow_drop_up</span>
            </button>
            <button
              class="button-number d-flex align-items-center"
              type="button"
              v-on:click.prevent="updateCharacterValue(character, -1)"
            >
              <span class="material-symbols-rounded icon-up" medium>arrow_drop_down</span>
            </button>
          </div>
          <span class="font-12 text-400">{{ $t('input.characters') }}</span>
        </div>
      </div>
    </div>
    <div class="div-column gap-5" v-if="customType !== 'file'">
      <span class="font-12 text-600 ds-gray-color mt-4">{{ $t('title.attributionType') }}</span>
      <div
        v-for="(input, index) in attributionSettings"
        :key="'attribution-settings' + index"
        class="div-row align-items-start pb-2"
      >
        <input
          type="radio"
          class="cursor-pointer"
          :id="`input-setting-${input.data}`"
          :key="'attribution-settings' + index"
          :checked="currentCustomField.attributionType ? index === selectedSettingIndex : index === 0"
          @click="changeSettingOption(index, input.data)"
          :disabled="currentCustomField.id"
        />
        <label
          :for="`input-setting-${input.data}`"
          class="font-12 text-400 pl-2 cursor-pointer mb-0 div-column label-settings"
        >
          <span
            :class="{
              'ds-blue-color text-600': currentCustomField.attributionType
                ? index === selectedSettingIndex
                : index === 0,
            }"
            >{{ input.title }}</span
          >
          <span>{{ input.description }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import { CustomFieldsDto } from '../dtos/customFieldsdto';

@Component({
  props: ['currentCustomField', 'customType'],
})
export default class CustomFieldsSettings extends Vue {
  @Prop() public currentCustomField!: CustomFieldsDto;
  @Prop() public customType!: string;

  label = '';
  placeholder = '';
  mask = '';
  characterLimit = 0;
  decimalLength = 0;
  selectedValues = '';
  selectedRenderType = '';
  listOptions = [''];
  listOptionIndex = 0;
  selectedSettingIndex = 0;
  showMenu = false;

  settingsSelect = [
    {
      type: 'number',
      label: this.$t('input.numberType'),
      placeholder: this.$t('input.selectNumber'),
      options: [
        { title: this.$t('input.decimalNumber'), value: 'decimal' },
        { title: this.$t('input.intNumber'), value: 'integer' },
      ],
    },
    {
      type: 'date',
      label: this.$t('input.format'),
      placeholder: this.$t('input.selectDate'),
      options: [
        { title: this.$t('datatable.date'), value: 'date' },
        { title: this.$t('input.dateHour'), value: 'dateHour' },
        { title: this.$t('input.timeStamp'), value: 'timeStamp' },
      ],
    },
    {
      type: 'list',
      label: this.$t('input.selectionType'),
      placeholder: this.$t('input.selection'),
      options: [
        { title: this.$t('input.sigleSelection'), value: 'single' },
        { title: this.$t('input.multipleSelection'), value: 'multiple' },
      ],
    },
  ];

  fileTypes = [{ title: 'pdf' }, { title: 'csv' }, { title: 'img' }];
  selectedFileTypes = [] as string[];
  charactersNumbers = [
    { type: 'text', label: this.$t('input.characterLimit'), key: 'characterLimit', value: 0 },
    { type: 'number', label: this.$t('input.characterComma'), key: 'decimalLength', value: 0 },
  ];
  attributionSettings = [
    { title: this.$t('input.firstLabel'), description: this.$t('input.firstDescription'), data: 'first' },
    { title: this.$t('input.lastLabel'), description: this.$t('input.lastDescription'), data: 'last' },
    { title: this.$t('input.multiLabel'), description: this.$t('input.multiDescription'), data: 'multi' },
  ];

  createOption(index: number, option: string) {
    this.listOptions[index] = option;
    this.listOptions.push();
    this.updateInput(this.listOptions, 'options');
  }

  addOption() {
    this.listOptions.push('');
    this.listOptionIndex++;
  }

  removeOption(index: number) {
    this.listOptions.splice(index, 1);
    this.listOptionIndex--;
  }

  changeSettingOption(index: number, value: string) {
    this.selectedSettingIndex = index;
    this.updateInput(value, 'attributionType');
  }

  updateCharacterValue(character: any, increment: number) {
    this.$set(character, 'value', Math.max(parseInt(character.value, 10) + increment, 0));
    this.updateInput(character.value, character.key);
  }

  updateInput(event: any, key: any) {
    this.$emit('updateInput', event, key);
  }

  filteredCharacters() {
    return this.charactersNumbers.filter((character) => character.type === this.customType);
  }

  filteredSelects() {
    return this.settingsSelect.filter((select) => select.type === this.customType);
  }

  filteredTypes() {
    const types: any = [
      { value: null, name: this.$t('input.fieldRenderType') },
      { value: 'dropdown', name: 'Dropdown' },
    ];

    if (this.selectedValues === 'single') {
      types.push({ value: 'radio', name: 'Radio button' });
    }

    if (this.selectedValues === 'multiple') {
      types.push({ value: 'checkbox', name: 'Checkbox' });
    }

    return types;
  }

  dragStart(event: any, item: any, index: any) {
    event.dataTransfer.setData('text/plain', JSON.stringify({ item, index }));
  }

  drop(event: any, newIndex: any) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const { item, index } = data;

    this.listOptions.splice(index, 1);
    this.listOptions.splice(newIndex, 0, item);
    this.updateInput(this.listOptions, 'options');
  }

  @Watch('selectedFileTypes')
  selectTypes() {
    this.updateInput(this.selectedFileTypes, 'fileFormats');
  }

  @Watch('currentCustomField', { immediate: true, deep: true })
  checkCustomField() {
    this.selectedValues = this.currentCustomField.fieldFormat || '';
    this.selectedRenderType = this.currentCustomField.fieldType || '';
    this.selectedFileTypes = this.currentCustomField.fileFormats || [];
    this.label = this.currentCustomField.label || '';
    this.placeholder = this.currentCustomField.placeholder || '';
    this.characterLimit = this.currentCustomField.characterLimit || 0;
    this.decimalLength = this.currentCustomField.decimalLength || 0;
    this.listOptions = this.currentCustomField.options || [''];
    this.mask = this.currentCustomField.mask || '';
    this.selectedSettingIndex =
      this.attributionSettings.findIndex((value: any) => value.data === this.currentCustomField.attributionType) || 0;
    this.charactersNumbers.forEach((character: any) => {
      if (character.key === 'characterLimit') {
        character.value = this.characterLimit;
      } else if (character.key === 'decimalLength') {
        character.value = this.decimalLength;
      }
    });
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.input-number {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  outline: none;
}

.input-size {
  height: 36px;
  width: 50px;
}

.button-number {
  height: 15px;
  outline: none;
}

.custom-fields-text {
  width: 60% !important;
}

.label-placeholder {
  display: grid;
}

.label-placeholder-wrapper {
  container-type: inline-size;
  container-name: label-placeholder;
  width: 100%;
}

.label-placeholder {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(4, 1fr);
}

@container label-placeholder (max-width: 1000px) {
  .label-placeholder {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.mask-info {
  width: 15px;
  height: 15px;
}

.settings-select {
  height: 36px !important;
  outline: none;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  background-color: #ffffff;
  padding-left: 8px;
  padding-right: 8px;
  display: flex;
  align-items: center;
  appearance: none;
  background-image: url('../../../../src/assets/select-icon.svg');
  background-repeat: no-repeat;
  background-position: right 1.3rem top 50%;
  background-size: 7px auto;
}

.settings-select:active {
  background-image: url('../../../../src/assets/select-icon-up.svg');
  background-repeat: no-repeat;
  background-position: right 1.3rem top 50%;
  background-size: 10px auto;
}

select:invalid {
  color: $neutral-gray-500;
}

.url-input {
  width: -webkit-fill-available;
}

.input-option {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  outline: none;
  height: 36px;
  width: -webkit-fill-available;
  padding: 0px 8px 0px 8px;
  color: #5c5c5c;
}

.add-option {
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
  cursor: pointer;
}

.formats-selected {
  border-radius: 50%;
  background-color: #f5f5f5;
  align-items: center;
  height: 20px;
  width: 20px;
  display: flex;
  justify-content: center;
}

.button-file {
  box-shadow: none;
  background-color: #ffffff !important;
  align-items: center;
  width: 100%;
}

.inputs-width {
  width: 100%;
}

.file-types:hover {
  background-color: #f5f5f5;
}

.file-types {
  justify-content: center;
  padding-top: 5px;
  padding-left: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid #f5f5f5;
}

.file-types:last-child {
  border: none;
}
.button-text {
  text-transform: none !important;
}
input::placeholder,
.button-file {
  color: $neutral-gray-500;
}

input.input-text-create {
  outline: none;
}

input:focus,
select:active {
  border: 1px solid $ds-blue !important;
}

.label-settings {
  margin-top: -2px;
}

.input-text-create {
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  height: 36px;
  color: $ds-gray;

  &:disabled {
    color: $ds-gray-300;
  }
}

.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
}

.drag-handle img {
  width: 20px;
  height: 20px;
  cursor: grab;
}
.trash-can-icon:hover {
  color: #5c5c5c;
}

.input-check {
  height: 12px;
  width: 12px;
}

.open-menu {
  transform: rotateZ(180deg);
}

.configure-link {
  text-decoration: none;
  justify-content: right;
  padding-top: 2px;
}

.disabled-input {
  background-color: $ds-gray-100;
}
</style>
