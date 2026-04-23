<template>
  <div class="view-interation-step">
    <div class="d-flex">
      <div class="group-input mt-auto">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('title.action') }}</label>
        </div>
        <div>
          <v-menu
            ref="menu"
            v-model="showAction"
            class="select-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                class="select-button"
                :class="{ 'select-button-open': showAction === true }"
                v-on="on"
                @click="showAction = true"
              >
                <div class="menu" v-on="on">
                  <p
                    class="ds-gray-color"
                    :class="{ 'menu-open text-600': showAction === true }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ selectedAction || $t('input.select') }}
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showAction === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="select-card" :class="{ 'select-card-open': showAction === true }">
              <div class="select-options" v-for="(action, index) in actions" :value="action.name" :key="action.value">
                <div class="option" @click="changeAction(index)" :class="!actions[index + 1] ? 'last-item' : ''">
                  {{ action.value }}
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
      <LineComponent :type="'vertical'" />
      <div class="group-input mt-auto menu-automation-list">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('title.automation') }}</label>
        </div>
        <v-menu
          class="select-menu"
          ref="menu"
          v-model="showAutomation"
          :close-on-content-click="false"
          bottom
          width="283"
        >
          <template v-slot:activator="{ on }">
            <button
              class="select-button font-12 text-space ds-gray-color"
              :class="{ 'text-600': selectedAutomation }"
              @click="showAutomation = true"
              v-on="on"
            >
              {{ selectedAutomation || $t('input.selectInsert') }}
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown ds-blue-color': showAutomation === true }"
              >
                arrow_drop_down
              </span>
            </button>
          </template>
          <div class="automation-card" :class="{ 'select-button-open automation-div': showAutomation === true }">
            <div class="div-row input-automation">
              <input
                id="automationsMenu"
                ref="automationsMenu"
                class="ds-gray-color font-12 text-space"
                type="text"
                v-model="automationName"
                :placeholder="$t('input.search')"
                @input="findAutomation(automationName)"
              />
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown ds-blue-color': showAutomation === true }"
              >
                arrow_drop_down
              </span>
            </div>
            <div class="automations-list-folder">
              <div
                class="automation-list d-flex ds-gray-color cursor-pointer font-12"
                @click="selectAutomation(undefined, 'any', undefined)"
              >
                {{ $t('input.anyAutomation') }}
              </div>
              <div
                class="automation-list d-flex ds-gray-color cursor-pointer font-12"
                v-for="automation in automations"
                :key="automation.id"
                @click="selectAutomation(automation.id, automation.name, automation.title)"
              >
                {{ automation.title }}
              </div>
            </div>
          </div>
        </v-menu>
      </div>
      <LineComponent :type="'vertical'" />
      <SelectConditionalComponent
        @updateStep="updateStep"
        :color="'select-light-purple'"
        :items="conditionalTime"
        :conditionalName="'conditional_times_value'"
        :value="step.conditional_times_value || '='"
      />
      <LineComponent :type="'vertical'" />
      <div>
        <label class="block font-12">{{ $t('input.times') }}</label>
        <input
          type="number"
          min="1"
          class="form-control w-50 value-input"
          @input="updateStep('custom_times_value', $event.target.value)"
          :value="step.custom_times_value || 0"
        />
      </div>
    </div>
    <div class="d-flex second-line-interactions">
      <LineComponent v-if="type !== 'automations'" :type="'vertical'" />
      <div class="group-input mt-auto">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('input.period') }}</label>
        </div>
        <div>
          <v-menu
            ref="menu"
            v-model="showTime"
            class="select-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                class="select-button"
                :class="{ 'select-button-open': showTime === true }"
                v-on="on"
                @click="showTime = true"
              >
                <div class="menu" v-on="on">
                  <p
                    class="ds-gray-color"
                    :class="{ 'menu-open': showTime === true }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ selectedTime || $t('input.select') }}
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showTime === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="select-card" :class="{ 'select-card-open': showTime === true }">
              <div class="select-options" v-for="(time, index) in timeType" :key="index">
                <div class="option" @click="changeTime(index)" :class="!timeType[index + 1] ? 'last-item' : ''">
                  {{ time.value }}
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
      <LineComponent :type="'vertical'" v-if="showTimeCustom" />
      <div class="mt-auto time-custom" :class="[{ 'time-custom-focus': isFocused }]" v-if="showTimeCustom">
        <input
          oninput="value = value.replace(/[^0-9]/g, '')"
          autofocus
          class="form-control mo-input days-input"
          @input="updateTime($event.target.value)"
          @focus="onFocus"
          @blur="onBlur"
          :value="timeCustom"
          placeholder="00"
          maxlength="3"
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
import { Component, Vue, Watch } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import ToastService from '@/services/toast.service';
import AutomationsService from '@/modules/automations/services/automations.service';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import { AutomationDto } from '@/modules/automations/dtos/automation.dto';

@Component({
  components: { LineComponent, SelectConditionalComponent },
  props: ['step', 'type'],
})
export default class AddAutomationComponent extends Vue {
  private readonly toastService = new ToastService();
  private readonly automationsService = new AutomationsService();
  public automations: Array<AutomationDto> = new Array<AutomationDto>();

  actions: any = [
    { name: 'entered', value: this.$t('input.entered') },
    { name: 'completed', value: this.$t('input.completed') },
    { name: 'running', value: this.$t('input.running') },
  ];
  timeType: any = [
    { name: '0', value: this.$t('input.today') },
    { name: '1', value: this.$t('input.yesterday') },
    { name: '7', value: this.$t('input.last7Days') },
    { name: '15', value: this.$t('input.last15Days') },
    { name: 'custom', value: this.$t('input.custom') },
  ];
  conditionalTime = [
    { name: '=', value: this.$t('input.valueIsEqual') },
    { name: '>', value: this.$t('input.valueGreater') },
    { name: '>=', value: this.$t('input.valueGreaterOrEqual') },
    { name: '<', value: this.$t('input.valueLess') },
    { name: '<=', value: this.$t('input.valueLessOrEqual') },
  ];
  action = '';
  eventType = '';
  time = '';
  timeCustom: any = '';
  showTime = false;
  showTimeCustom = false;
  showAction = false;
  showAutomation = false;
  showType = false;
  selectedTime = '';
  selectedAction = '';
  isFocused = false;
  automationName = '';
  selectedAutomation = '';

  beforeMount() {
    this.findAutomation();
    const step = this.$props.step;
    this.action = step?.event || 'entered';
    this.selectedAction = this.actions.find((x: any) => x.name === this.action)?.value || this.$t('input.entered');
    this.time = step?.time || '';
    this.selectedTime = this.timeType.find((x: any) => x.name === this.time)?.value;
    this.selectedTime = !this.selectedTime && this.time ? (this.$t('input.custom') as string) : this.selectedTime;
    this.timeCustom = this.selectedTime === this.$t('input.custom') ? this.time : '';
    this.showTimeCustom = this.timeCustom ? true : false;

    if (step?.automation) {
      this.selectedAutomation = step?.automation === 'any' ? this.$t('input.anyAutomation') : step?.automation.title;
    }
    this.updateStep('event', this.action);
  }
  onFocus() {
    this.isFocused = true;
  }
  onBlur() {
    this.isFocused = false;
  }
  removeStep() {
    this.$emit('removeStep');
  }
  updateStep(key: string, value: string | number | object) {
    this.$emit('updateStep', key, value);
  }
  updateTime(time: any) {
    if (time > 90) {
      this.timeCustom = 90;
      time = 90;
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.customBiggerThan90') as string,
      });
    }
    this.timeCustom = time;
    this.updateStep('time', this.timeCustom || 0);
  }
  changeAction(index: number) {
    this.action = this.actions[index].name;
    this.selectedAction = this.actions[index].value;
    this.showAction = false;
    this.updateStep('event', this.action);
  }
  changeTime(index: number) {
    this.time = this.timeType[index].name;
    this.selectedTime = this.timeType[index].value;
    this.showTime = false;
    if (this.time === 'custom') {
      this.updateTime('');
      this.showTimeCustom = true;
    } else {
      this.updateStep('time', this.time);
      this.showTimeCustom = false;
    }
  }

  async findAutomation(search?: string): Promise<any> {
    try {
      const response: any = await this.automationsService.getAutomations(
        {
          page: 1,
          itemsPerPage: 10,
        },
        { title: search || '' }
      );
      this.automations = response.data?.results.map((automation: any) => {
        return {
          id: automation.id,
          title: automation.title,
          name: automation.name,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  selectAutomation(
    automationId: number | undefined,
    automationName: string | undefined,
    automationTitle: string | undefined
  ) {
    this.showAutomation = false;
    this.selectedAutomation =
      automationName === 'any' ? (this.$t('input.anyAutomation') as string) : automationTitle || '';
    const automationObj =
      automationId !== undefined
        ? {
            id: automationId,
            name: automationName,
            title: automationTitle,
          }
        : automationName;
    this.updateStep('automation', automationObj || '');
  }

  @Watch('showAutomation')
  focusOnInput() {
    this.$nextTick(() => {
      const inputElement = this.$refs.automationsMenu as HTMLElement | null;

      if (this.showAutomation === true && inputElement) {
        setTimeout(() => {
          inputElement.focus();
        }, 200);
      }
    });
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.group-input label {
  display: block;
}
.time-custom {
  display: flex;
  align-items: center;
  width: 160px;
  gap: 5px;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  height: 36px !important;
  padding: 0.375rem 0rem 0.375rem 0.375rem;
  transition: border-color 0.15s ease-in-out;
}
.time-custom-focus {
  border: 1px $ds-blue solid !important;
}
.mo-input:focus {
  border: none !important;
  box-shadow: none;
  color: $ds-blue;
}
.mo-input {
  height: 28px !important;
  border-radius: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.days-input {
  width: 20% !important;
}
.days {
  font-size: 12px;
  right: 0.75rem;
  top: 0.375rem;
  color: $ds-gray;
}
.max-days {
  color: $neutral-gray-500;
  font-size: 12px;
}

label {
  color: $ds-gray !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 220px;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
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
  width: 283px;
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
  border-radius: 0px 0px 8px 8px !important;
  width: 176px;
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
.div-trash {
  display: flex;
  align-items: flex-end;
}

.text-space {
  text-wrap: nowrap;
  outline: none;
  letter-spacing: 0.05em;
  width: 310px;
}

.automation-card {
  background-color: #ffffff;
  width: -webkit-fill-available;
}

.input-automation {
  justify-content: space-between;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  overflow: hidden;
  border-bottom: 1px solid #d9d9d9;
}

.search-input {
  outline: none;
}

.automation-div {
  border-bottom: 1px solid $ds-blue;
  border-radius: 8px !important;
}

.automations-list-folder {
  max-height: 200px;
  overflow-y: scroll;
}

.automation-list {
  border-top: 1px solid #d9d9d9;
  height: 36px;
  padding-left: 11px !important;
  align-items: center;
}

.automation-list:first-child {
  border-top: none;
}

.second-line-interactions {
  margin-top: 10px;
  margin-left: -16px;
}
</style>
