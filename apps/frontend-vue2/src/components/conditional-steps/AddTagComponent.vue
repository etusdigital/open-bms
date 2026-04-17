<template>
  <div class="view-tag-step d-flex container-style">
    <SelectConditionalComponent
      @updateStep="updateStep"
      :color="color || 'select-light-purple'"
      :items="conditionalTags"
      :conditionalName="'conditional_tag'"
      :value="step.conditional_tag || 'in'"
      :style="tagsSelected.length > 5 ? 'display: flex; align-items: flex-start; margin-top: 30px;' : ''"
      :disabled="disabled"
    />
    <LineComponent
      :type="'vertical'"
      :style="tagsSelected.length > 5 ? 'display: flex; align-items: flex-start; margin-top: 48px;' : ''"
    />
    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between addTagGroupTop">
        <label class="block"> {{ $t('datatable.tagAndSegment') }} </label>
      </div>
      <v-autocomplete
        v-model="tagsSelected"
        :items="parseTags()"
        item-text="name"
        chips
        deletable-chips
        class="mo-input font-14"
        return-object
        multiple
        :label="`${$t('input.select')}`"
        solo
        :no-data-text="`${$t('datatable.noData')}`"
        cache-items
        :disabled="disabled"
      >
        <template v-slot:item="{ item }">
          <v-list-item-content class="font-12">
            {{ item.name }}
            <template v-if="item.count"> ({{ item.count | formatNumber }}) </template>
          </v-list-item-content>
        </template>

        <template v-slot:selection="data">
          <v-chip
            class="options"
            v-bind="data.attrs"
            :input-value="data.selected"
            :disabled="disabled"
            :close="!disabled"
            @click="data.select"
            @click:close="removeTag(data.item)"
          >
            {{ data.item.name }}
            <template v-if="data.item.count && !disabled && !desactive">
              ({{ data.item.count | formatNumber }})
            </template>
          </v-chip>
        </template>
      </v-autocomplete>
    </div>
    <div class="div-trash" v-if="!disabled && !desactive">
      <button class="ml-auto button-trash" @click="removeStep" type="button">
        <span class="material-symbols-rounded font-24 delete-icon">delete</span>
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import SelectConditionalComponent from './SelectConditionalComponent.vue';

@Component({
  components: { LineComponent, SelectConditionalComponent },
  props: ['tags', 'step', 'disabled', 'color', 'desactive'],
})
export default class AddTagComponent extends Vue {
  @Prop() tags!: any[];
  @Prop() step!: any;
  @Prop() color!: string;
  @Prop() disabled!: boolean;
  @Prop() desactive!: boolean;
  tagsSelected: any = '';
  conditionalTags = [
    { name: 'in', value: this.$t('title.has') },
    { name: 'not in', value: this.$t('title.doesNotHas') },
  ];

  beforeMount() {
    this.tagsSelected = this.$props.step?.tag_info || [];
  }

  removeStep() {
    this.$emit('removeStep');
  }

  updateStep(key: string, value: any) {
    this.$emit('updateStep', key, value);
  }

  removeTag(item: any) {
    const index = this.tagsSelected.findIndex((x: any) => x.id === item.id);
    if (index >= 0) {
      this.tagsSelected.splice(index, 1);
    }
  }

  @Watch('step')
  checkStep() {
    this.tagsSelected = this.$props.step?.tag_info || [];
  }

  @Watch('tagsSelected')
  updateTags() {
    const ids = this.tagsSelected.map((item: any) => {
      return item.id;
    });
    this.updateStep('tag_id', ids);
    this.updateStep('tag_info', this.tagsSelected);
  }

  parseTags() {
    return this.$props.tags
      .map((tag: any) => {
        return {
          id: tag.id,
          name: tag.name,
          count: tag.lastCount,
          type: tag.type,
        };
      })
      .sort((a: any, b: any) => (a.name > b.name ? -1 : 1))
      .sort((a: any, b: any) => (a.type > b.type ? 1 : -1));
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

label {
  color: $ds-gray !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

::v-deep .v-text-field__details {
  display: none;
}
::v-deep .v-text-field.v-text-field--solo .v-input__control {
  min-height: 36px !important;
}
::v-deep .v-select.v-select--chips .v-select__selections {
  min-height: 36px !important;
}
::v-deep .v-input__slot {
  margin-bottom: 0;
}
::v-deep label.v-label.theme--light {
  margin: 0px !important;
}
::v-deep .v-chip.v-size--default {
  height: auto;
}
::v-deep .v-input {
  font-size: 10px;
}
::v-deep .v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  -webkit-box-shadow: none;
  box-shadow: none;
  border: 1px solid #ced4da;
}
::v-deep .v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot:focus {
  border: 1px $ds-blue solid !important;
}
.mo-input {
  border-radius: 8px;
  min-width: 176px;
  width: fit-content !important;
  height: max-content !important;
  font-size: 12px !important;
}

::v-deep .v-input__control {
  height: max-content !important;
}
::v-deep .v-select__selections {
  height: fit-content !important;
}
::v-deep .v-label {
  font-size: 12px !important;
}

.div-trash {
  display: flex;
  align-items: flex-end;
  margin: 0px 0px 2px 10px;
}

.delete-icon {
  color: #a6a6a6;
  margin-bottom: -4px;
}

.delete-icon:hover {
  color: red;
}

.addTagGroupTop {
  margin-top: 24px;
}

.container-style {
  margin-top: -16px;
}
</style>
