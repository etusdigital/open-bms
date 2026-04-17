<template>
  <div class="div-column gap-5 align-items-start">
    <span class="ds-gray-color font-12 text-600">
      {{ $t('sidebar.labels') }}
    </span>
    <v-menu
      ref="menu"
      v-model="showLabels"
      class="message-menu"
      :close-on-content-click="false"
      transition="scale-y-transition"
      width="283"
    >
      <template v-slot:activator="{ on }">
        <button type="button" class="menu-messages ds-gray-color" v-on="on" @click="focusInput">
          <span class="font-12">{{ $t('input.selectLabels') }}</span>
          <span class="ds-gray-color material-symbols-rounded">arrow_drop_down</span>
        </button>
      </template>
      <v-card class="message-card">
        <div class="search-bar-select">
          <input
            id="labels-search"
            class="search-input"
            type="text"
            v-model="labelValue"
            :placeholder="`${$t('input.searchLabel')}`"
            @input="getLabels($event.target.value)"
          />
          <span
            class="material-symbols-rounded font-20 cursor-pointer"
            :class="{ 'ds-blue-color': showLabels === true }"
          >
            search
          </span>
        </div>
        <div v-if="isLoadingLabels" class="load-icon py-3">
          <span class="d-flex material-symbols-rounded ds-blue-color rotate-icon">progress_activity</span>
        </div>
        <div v-else class="message-list">
          <div class="checkbox-message pl-2" :key="`label-modal-filter-${i}`" v-for="(label, i) in localLabels">
            <input
              type="checkbox"
              :key="`search-input-label-${i}`"
              :id="`message-options-${label.id}`"
              v-model="selectedLabels"
              :value="{ ...label }"
              class="input-filters"
              :disabled="selectedLabels.length >= 10"
            />
            <label
              class="label-filters"
              :for="`message-options-${label.id}`"
              :key="`message-labels-${i}`"
              :disabled="selectedLabels.length >= 10"
              >{{ label.name }}</label
            >
          </div>
        </div>
        <div class="pr-3 pt-3 pb-3 div-row gap-10 message-button">
          <button
            type="button"
            class="clear-fields text-600 font-10 ds-blue-color"
            :disabled="!selectedLabels.length"
            @click.prevent="clearLabels"
          >
            {{ $t('button.clear') }}
          </button>
          <button
            type="button"
            class="apply-button text-600"
            :disabled="!selectedLabels.length"
            @click.prevent="selectLabels"
          >
            {{ $t('button.apply') }}
          </button>
        </div>
      </v-card>
    </v-menu>
    <div class="div-row gap-5 mt-2" v-if="chipLabels.length > 0">
      <div
        class="div-row gap-10 chip-label"
        :key="`chip-${index}`"
        v-for="(chip, index) in chipLabels"
        v-tooltip.top="chip.name"
      >
        <span class="chip-text ds-gray-color font-12 text-600 chip-text">{{ chip.name }}</span>
        <span class="material-symbols-rounded ds-gray-color font-16 cursor-pointer" @click="removeLabel(chip.id)">
          close
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import { LabelDto } from '../dtos/label.dto';
import LabelService from '../services/label.service';
import { LabelContentDto } from '../dtos/labelContent.dto';

@Component({
  props: ['labelContent'],
})
export default class LabelSelectComponent extends Vue {
  @Prop({ default: () => [] }) labelContent!: LabelContentDto[];
  private readonly labelService = new LabelService();

  isLoadingLabels = false;
  showLabels = false;
  chipLabels: LabelDto[] = [];
  labelValue = '';
  selectedLabels: LabelDto[] = [];
  localLabels: LabelDto[] = [];

  async beforeMount() {
    await this.getLabels();
    this.initializeSelectedLabels();
  }

  initializeSelectedLabels() {
    if (this.labelContent && this.labelContent.length > 0 && this.localLabels.length > 0) {
      const savedLabels = this.labelContent.map((content: LabelContentDto) => content.label);

      this.selectedLabels = this.localLabels.filter((localLabel) =>
        savedLabels.some((savedLabel) => savedLabel.id === localLabel.id)
      );
      this.chipLabels = [...this.selectedLabels];
    }
  }

  private getSimplifiedLabels(labels: LabelDto[]): { id: number; name: string }[] {
    return labels.map((label) => ({
      id: label.id,
      name: label.name || '',
    }));
  }

  focusInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('labels-search');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  async getLabels(label?: string) {
    try {
      this.isLoadingLabels = true;
      const result = await this.labelService.getLabels({
        name: label || undefined,
      });
      this.localLabels = result?.data?.results;
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingLabels = false;
    }
  }

  selectLabels() {
    this.showLabels = false;
    this.chipLabels = [...this.selectedLabels];
    this.$emit('selectLabels', this.getSimplifiedLabels(this.selectedLabels));
  }

  clearLabels() {
    this.selectedLabels = [];
    this.chipLabels = [];
    this.$emit('selectLabels', []);
  }

  removeLabel(id: number) {
    this.chipLabels = this.chipLabels.filter((label: LabelDto) => label.id !== id);
    this.selectedLabels = [...this.chipLabels];
    this.$emit('selectLabels', this.getSimplifiedLabels(this.selectedLabels));
  }

  @Watch('labelContent', { deep: true })
  onLabelContentChange() {
    if (this.localLabels.length > 0) {
      this.initializeSelectedLabels();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.message-menu {
  display: none;
}

.menu-messages {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  min-height: 36px !important;
  border-radius: 8px;
  cursor: pointer;
  background-color: #ffffff;
  width: 100%;
  &:disabled {
    cursor: not-allowed;
  }
}

.message-card {
  border-radius: 8px;
  border: 1px solid $ds-blue !important;
}
.search-bar-select {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  padding-right: 12px;
  padding-left: 12px;
  overflow: hidden;
  align-items: center;
  &:hover {
    background-color: #f5f5f5;
  }
}

.chip-label {
  padding: 4px 8px;
  border-radius: 16px;
  background-color: $neutral-basic-white;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 1px solid $ds-gray-400;
}

.checkbox-message {
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  &:hover {
    background-color: #f5f5f5;
  }
}
.message-list {
  max-height: 150px;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}
.message-button {
  justify-content: right;
}
.clear-fields {
  text-transform: uppercase;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}

.apply-button {
  background-color: $ds-blue;
  border-radius: 8px;
  padding: 12px;
  color: #ffffff;
  font-size: 10px;
  text-transform: uppercase;
  height: 26px;
  align-items: center;
  display: flex;
  &:disabled {
    background-color: #d9d9d9;
    color: #a6a6a6;
  }
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

.load-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

.chip-text {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-wrap: nowrap;
}

::v-deep.v-menu__content {
  border-radius: 8px !important;
  width: 283px;
  z-index: 10 !important;
}
</style>
