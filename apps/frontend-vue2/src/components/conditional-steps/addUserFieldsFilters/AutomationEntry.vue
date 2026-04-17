<template>
  <div class="div-column mt-5">
    <div class="d-flex justify-space-between">
      <label class="mb-0 font-12 text-600">
        {{ $t('title.filter') }}
      </label>
    </div>
    <div class="div-row">
      <div class="group-input mt-auto input-automation">
        <v-autocomplete
          v-model="automationSelected"
          :items="automations"
          item-text="title"
          multiple
          class="mo-input"
          return-object
          :label="`${$t('input.select')}`"
          solo
          :no-data-text="`${$t('datatable.noData')}`"
          cache-items
        >
          <template v-slot:selection="{ item, index }">
            <v-chip class="chip-size chip-style" v-if="index < 2">
              <span class="chip-text font-10 ds-gray-color">{{ item.title }}</span>
              <span
                class="material-symbols-rounded ds-gray-color font-18 cursor-pointer"
                @click="removeAutomation(item.id)"
                >close</span
              >
            </v-chip>
            <span v-if="index === 2" class="ds-gray-color font-10 align-self-center">
              (+{{ automationSelected.length - 2 }} {{ $t('input.others') }})
            </span>
          </template>
        </v-autocomplete>
      </div>

      <LineComponent :type="'vertical'" />

      <SelectConditionalComponent
        @updateStep="updateStep"
        :disabled="true"
        :color="'select-light-purple'"
        :items="conditionalUserFields"
        :conditionalName="'conditional_user_field'"
        :value="step.conditional_user_field || '>='"
      />

      <LineComponent :type="'vertical'" />

      <div class="mt-auto time-custom">
        <input
          oninput="value = value.replace(/[^0-9]/g, '');"
          @input="updateStep('user_field_value', $event.target.value)"
          autofocus
          class="form-control mo-input-days days-input"
          :value="step.user_field_value"
          placeholder="00"
          maxlength="2"
        />
        <span class="days"
          >{{ $t('input.days') }} <span class="max-days">({{ $t('input.max90') }})</span></span
        >
      </div>
      <div class="div-trash ml-2">
        <button class="ml-auto button-trash" @click="removeStep" type="button">
          <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import SelectConditionalComponent from '../SelectConditionalComponent.vue';
import LineComponent from '../LineComponent.vue';
import AutomationsService from '@/modules/automations/services/automations.service';
import { UserFieldsTypes } from '@/interfaces/step-conditional.interfaces';

@Component({
  components: { SelectConditionalComponent, LineComponent },
  props: ['step'],
})
export default class AutomationEntry extends Vue {
  @Prop() step!: any;
  private readonly automationServices = new AutomationsService();
  public userField = UserFieldsTypes;
  userFieldKey = '';
  showUserField = false;
  automationSelected: any = '';
  automations: any = [];

  conditionalUserFields = [{ name: '>=', value: 'Nos últimos' }];
  listUserFields = [{ name: UserFieldsTypes.AUTOMATION_ENTRY, value: this.$t('input.entryAutomation') }];

  async listAutomation() {
    const automations = await this.automationServices.getAutomations({ page: 1, itemsPerPage: 10 }, { type: 'email' });
    this.automations = (automations?.data.results || []).map((automation: any) => {
      return { id: automation.id, title: automation.title };
    });
  }

  async beforeMount() {
    this.automationSelected = this.$props.step.user_field_automation;
    await this.listAutomation();
    this.userFieldKey = this.listUserFields.map((x: any) => x.name).toString();
    this.updateStep('user_field_key', this.userFieldKey);
  }
  @Watch('automationSelected')
  changeAutomationSelected() {
    if (this.automationSelected) {
      const automationsSelected = this.automationSelected.map((automation: any) => {
        return {
          id: automation.id,
          title: automation.title,
        };
      });
      this.updateStep('user_field_automation', automationsSelected);
    }
  }
  updateStep(key: string, value: any) {
    this.$emit('updateStep', key, value);
  }

  removeStep() {
    this.$emit('removeStep');
  }

  removeAutomation(id: number) {
    this.automationSelected = this.automationSelected.filter((automation: any) => automation.id !== id);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 176px;
}
.time-custom {
  display: flex;
  align-items: center;
  width: 160px;
  gap: 5px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  height: 36px !important;
  padding: 0.375rem 0rem 0.375rem 0.375rem;
  transition: border-color 0.15s ease-in-out;
}
.mo-input-days:focus {
  border: none !important;
  box-shadow: none;
  color: $ds-blue;
}
.mo-input-days {
  height: 28px !important;
  border-radius: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.mo-input {
  border-radius: 8px;
  min-width: 176px;
  width: 400px !important;
  height: 36px !important;
  font-size: 12px !important;
}

.days-input {
  width: 20% !important;
}
.days {
  font-size: 12px;
  right: 0.75rem;
  top: 0.375rem;
  color: #5c5c5c;
}
.max-days {
  color: #a6a6ab;
  font-size: 12px;
}
.div-trash {
  display: flex;
  align-items: flex-end;
}

.chip-size {
  height: 26px;
}

.chip-style {
  border-radius: 16px;
  border: 1px solid $ds-gray-300;
  background-color: $neutral-basic-white !important;
}

.chip-text {
  white-space: nowrap;
  max-width: 50px;
  text-overflow: ellipsis;
  overflow: hidden;
}

::v-deep.v-list.v-select-list.v-sheet {
  max-width: 400px !important;
  margin-right: -10px !important;
  // max-width: 400px;
}
</style>
