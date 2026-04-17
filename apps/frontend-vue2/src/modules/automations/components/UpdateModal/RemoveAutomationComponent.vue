<template>
  <div v-if="render">
    <label class="label-title mb-0 mt-1 font-14">{{ $t('input.chooseAutomation') }}</label>
    <div style="position: relative">
      <v-autocomplete
        v-model="selectedOptionData.automations"
        item-color="#EBE9E8"
        :elevation="0"
        class="c-autocomplete mt-2"
        :class="{ 'have-item-selected': selectedOptionData.automations && selectedOptionData.automations.length }"
        :placeholder="`${$t('input.select')}`"
        :no-data-text="
          isLoadingSearch
            ? $t('input.searching')
            : searchOptions
            ? `${$t('datatable.noData')}`
            : $t('input.noAutomations')
        "
        :items="optionsSelect"
        :item-text="'name'"
        :return-object="true"
        :multiple="true"
        :outlined="false"
        :search-input.sync="searchOptions"
        :loading="isLoadingSearch"
        @change="changeSelectedOptionDataPropety(selectedOptionData.automations, 'automations')"
        @click="handleAutocompleteClick()"
        solo
      >
        <template v-slot:item="{ item }">
          <v-list-item-content>
            {{ item.title }}
          </v-list-item-content>
        </template>

        <!-- eslint-disable-next-line vue/no-unused-vars -->
        <template v-slot:selection="data"> </template>
      </v-autocomplete>
      <div v-if="selectedOptionData.automations && selectedOptionData.automations.length" class="selected-items">
        {{ $t('input.selected') }}
        <span class="ml-2 counter">
          {{ selectedOptionData.automations ? selectedOptionData.automations.length : 0 }}
        </span>
      </div>
    </div>

    <div class="automation-list mt-2">
      <div
        v-for="(automation, index) in selectedOptionData.automations"
        style="display: flex; align-items: center"
        :key="index"
      >
        <div class="automation mt-2">
          <div class="automation-content">
            <h4>{{ $t('input.name') }}: {{ automation.title }}</h4>
            <p class="mb-0">{{ $t('create.description') }}: {{ automation.subject }}</p>
          </div>
        </div>
        <div class="div-trash ml-2">
          <button class="ml-auto button-trash" type="button" @click="removeAutomation(index)">
            <span class="material-symbols-rounded ds-light-gray-color">delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import AutomationsService from '@/modules/automations/services/automations.service';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  props: ['render', 'step'],
})
export default class RemoveAutomationComponent extends Vue {
  private readonly automationsService = new AutomationsService();
  @Prop() step!: any;
  @Prop() render!: boolean;
  optionsSelect = [];
  selectedOptionData: any = {
    automations: [],
  };
  lastSearch = '';
  isLoadingSearch = false;
  searchOptions = null;

  isInitialRequestMade = false;

  async beforeMount() {
    this.showModal();

    if (!this.step?.settings || !Object.keys(this.step?.settings).length) {
      this.updateData();
    }
  }

  hideModal() {
    this.$emit('hideModal');
  }

  changeSelectedOptionDataPropety(value: any, key: string) {
    const self = this;
    this.selectedOptionData[key as keyof typeof self.selectedOptionData] = value;
    this.updateData();
  }

  updateData() {
    this.$emit('updateInfo', this.selectedOptionData);
  }

  @Watch('render')
  showModal() {
    if (this.render) {
      this.selectedOptionData =
        this.step?.settings && Object.keys(this.step?.settings).length ? this.step?.settings : this.selectedOptionData;
      this.searchOptions = this.step?.settings?.name;
      this.updateData();
    }
  }

  async findAutomation(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.automationsService.getAutomations(
        { page: 1, itemsPerPage: 10 },
        { title: search || '', type: 'email' }
      );
      return response.data?.results.map((automation: any) => {
        return {
          id: automation.id,
          name: automation.name,
          title: automation.title,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  async handleAutocompleteClick() {
    if (!this.isInitialRequestMade) {
      this.isInitialRequestMade = true;
      this.optionsSelect = await this.findAutomation();
    }
  }

  @Watch('searchOptions')
  async onSearch(search: string) {
    if (search && search !== this.lastSearch) {
      this.optionsSelect = await this.findAutomation(search);
      this.lastSearch = search;
    }
  }

  removeAutomation(index: number) {
    this.selectedOptionData.automations.splice(index, 1);
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

.c-autocomplete {
  border-radius: 8px;
  border: $ds-gray-300 solid 1px !important;
  font-size: 12px;
  ::v-deep .v-input__control {
    height: auto !important;
    min-height: auto !important;
  }

  ::v-deep .v-input__slot {
    margin: 0 !important;
  }
}

::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none !important;
}

.have-item-selected {
  padding-left: 115px !important;
}

.selected-items {
  position: absolute;
  top: 12px;
  left: 12px;
  font-size: 12px;
  font-weight: bold;
  color: $ds-gray;
}

.counter {
  padding: 2px 7px;
  background: $ds-gray-100;
  border-radius: 50%;
  font-size: 12px;
}

.automation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 98%;
  background: $ds-gray-100;
  border-radius: 8px;
  padding: 12px 10px;
}

.automation-content {
  h4 {
    font-size: 12px;
    font-weight: 600;
  }

  p {
    font-size: 12px;
  }
}

.view-button {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.view-icon {
  height: 24px;
  filter: invert(75%) sepia(52%) saturate(13%) hue-rotate(333deg) brightness(100%) contrast(79%);
}

.view-icon:hover {
  cursor: pointer;
  filter: none;
}

.div-trash {
  margin-top: 6px;
}

input[type='radio'] {
  width: 14px;
  height: 14px;
  -webkit-appearance: none;
  background-color: transparent;
  border: $ds-gray-300 2px solid;
  border-radius: 50%;
}

input[type='radio']:checked {
  border: $ds-blue 2px solid;
}

.winner-criteria-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  span {
    font-size: 12px;
  }
}

.radio-circle {
  position: absolute;
  width: 6px;
  height: 6px;
  background-color: $ds-blue;
  border-radius: 50%;
  left: 4px;
}

.label-radio {
  font-size: 12px;
  margin-bottom: 0px !important;
}

.choose-option {
  color: $ds-blue;
  font-weight: bold;
}

.div-more-items {
  display: flex;
  width: 100%;
  gap: 8px;
}

input[type='number'] {
  -moz-appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-style {
  height: 36px;
  font-weight: 400;
  font-size: 12px;
  border-radius: 8px;
  width: 100%;
  flex: 1;
  padding: 8px 9px;
  border: 1px $ds-gray-300 solid;
  outline: none;

  &:focus {
    border: 1px $ds-blue solid;
    outline: none;
  }
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 100%;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
  position: relative;
  border-radius: 0px 0px 8px 8px !important;
}
.select-options {
  border-bottom: 1px solid $ds-gray-100;
}
.option {
  border-top: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 8px;
  background-color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: $ds-gray;

  &:hover {
    background: $ds-gray-100;
  }
}

.last-item {
  border-radius: 0px 0px 8px 8px !important;
}

.select-button {
  width: 100%;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  box-shadow: none;
  overflow: unset !important;
  border-radius: 8px;
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
  width: fit-content;
  border-radius: 0px 0px 8px 8px !important;
}

.menu {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;

  & > p {
    font-size: 12px;
    margin: 0;
    text-transform: none;
    font-weight: normal;
  }

  & > .menu-open {
    color: $ds-blue;
  }
}
.icon-up {
  color: $ds-gray;
}

.automation-list {
  max-height: 250px;
  overflow-y: auto;
}

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
</style>
