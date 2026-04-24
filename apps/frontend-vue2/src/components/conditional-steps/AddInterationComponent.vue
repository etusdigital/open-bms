<template>
  <div class="view-interation-step">
    <div class="d-flex">
      <div class="group-input mt-auto">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('datatable.type') }}</label>
        </div>
        <div>
          <v-menu
            ref="menu"
            v-model="showType"
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
                :class="{ 'select-button-open': showType === true }"
                v-on="on"
                @click="showType = true"
              >
                <div class="menu" v-on="on">
                  <p
                    class="ds-gray-color"
                    :class="{ 'menu-open': showType === true }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ selectedType }}
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showType === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="select-card" :class="{ 'select-card-open': showType === true }">
              <div
                class="select-options"
                v-for="(action, index) in actionsTypes"
                :value="action.name"
                :key="action.name"
              >
                <div class="option" @click="changeType(index)" :class="!actionsTypes[index + 1] ? 'last-item' : ''">
                  {{ action.value }}
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
      <template v-if="eventType !== 'anyChannel'">
        <LineComponent :type="'vertical'" />
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
                    {{ $t(`input.${action.value}`) }}
                  </div>
                </div>
              </v-card>
            </v-menu>
          </div>
        </div>
        <LineComponent :type="'vertical'" v-if="type !== 'automations'" />
        <template v-if="eventType !== 'page_view'">
          <div v-if="type !== 'automations'" class="group-input mt-auto menu-message-list">
            <div class="d-flex justify-space-between">
              <label class="block">{{ $t('title.message') }}</label>
            </div>
            <v-menu
              class="select-menu"
              ref="menu"
              v-model="showMessage"
              :close-on-content-click="false"
              bottom
              width="283"
            >
              <template v-slot:activator="{ on }">
                <button
                  class="select-button font-12 text-space ds-gray-color"
                  :class="{ 'text-600': selectedMessage }"
                  @click="showMessage = true"
                  v-on="on"
                >
                  {{ selectedMessage || $t('input.selectInsert') }}
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showMessage === true }"
                  >
                    arrow_drop_down
                  </span>
                </button>
              </template>
              <div class="message-card" :class="{ 'select-button-open message-div': showMessage === true }">
                <div class="div-row input-message">
                  <input
                    id="messagesMenu"
                    ref="messagesMenu"
                    class="ds-gray-color font-12 text-space"
                    type="text"
                    v-model="messageName"
                    :placeholder="$t('input.selectMessage')"
                    @input="findMessage(messageName)"
                  />
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showMessage === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
                <div class="messages-list-folder">
                  <div
                    class="message-list d-flex ds-gray-color cursor-pointer font-12"
                    @click="selectMessage(undefined, 'any', undefined)"
                  >
                    {{ $t('input.anyMessage') }}
                  </div>
                  <div
                    class="message-list d-flex ds-gray-color cursor-pointer font-12"
                    v-for="message in messages"
                    :key="message.id"
                    @click="selectMessage(message.id, message.name, message.title)"
                  >
                    {{ message.title }}
                  </div>
                </div>
              </div>
            </v-menu>
          </div>
        </template>
        <template v-else>
          <SelectConditionalComponent
            v-if="type !== 'automations'"
            @updateStep="updateStep"
            :color="'select-light-purple'"
            :items="pageViewConditionalType"
            :conditionalName="'page_view_filter'"
            :value="step.page_view_filter || '='"
          />
          <LineComponent :type="'vertical'" />
          <div v-if="type !== 'automations'">
            <label class="block font-12">URL</label>
            <input
              type="text"
              class="form-control value-input"
              @input="updateStep('page_view_value', $event.target.value)"
              :value="step.page_view_value || ''"
            />
          </div>
        </template>
        <LineComponent :type="'vertical'" v-if="type !== 'automations' && step.conditional_interation !== 'not'" />
        <SelectConditionalComponent
          v-if="type !== 'automations' && step.conditional_interation !== 'not'"
          @updateStep="updateStep"
          :color="'select-light-purple'"
          :items="conditionalTime"
          :conditionalName="'conditional_times_value'"
          :value="step.conditional_times_value || '>='"
        />
        <LineComponent :type="'vertical'" v-if="type !== 'automations' && step.conditional_interation !== 'not'" />
        <div v-if="type !== 'automations' && step.conditional_interation !== 'not'">
          <label class="block font-12">{{ $t('input.times') }}</label>
          <input
            type="number"
            min="1"
            class="form-control w-50 value-input"
            @input="updateStep('custom_times_value', $event.target.value)"
            :value="step.custom_times_value || 1"
          />
        </div>
      </template>
    </div>
    <div class="d-flex second-line-interactions">
      <LineComponent :type="'vertical'" />
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
import {
  InterationEmailTypes,
  InterationPushTypes,
  InterationPageViewTypes,
  InterationSmsTypes,
  InterationWhatsappTypes,
} from '@/interfaces/step-conditional.interfaces';
import ToastService from '@/services/toast.service';
import MessagesService from '@/modules/messages/services/messages.service';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import SelectConditionalComponent from './SelectConditionalComponent.vue';

@Component({
  components: { LineComponent, SelectConditionalComponent },
  props: ['step', 'type'],
})
export default class AddInterationComponent extends Vue {
  private readonly toastService = new ToastService();
  private readonly messagesService = new MessagesService();
  public messages: Array<MessageDto> = new Array<MessageDto>();

  actions: any = [];
  actionsTypes: any = [
    { name: 'email', value: this.$t('title.email') },
    { name: 'web-push', value: this.$t('title.push') },
    { name: 'mobile-push', value: this.$t('title.mobile-push') },
    { name: 'sms', value: this.$t('title.sms') },
    { name: 'whatsapp', value: this.$t('title.whatsapp') },
  ];
  timeType: any = [
    { name: '0', value: this.$t('input.today') },
    { name: '1', value: this.$t('input.yesterday') },
    { name: '7', value: this.$t('input.last7Days') },
    { name: '15', value: this.$t('input.last15Days') },
    { name: 'all', value: this.$t('input.anyTime') },
    { name: 'custom', value: this.$t('input.custom') },
  ];
  conditionalTime = [
    { name: '=', value: this.$t('input.valueIsEqual') },
    { name: '>', value: this.$t('input.valueGreater') },
    { name: '>=', value: this.$t('input.valueGreaterOrEqual') },
    { name: '<', value: this.$t('input.valueLess') },
    { name: '<=', value: this.$t('input.valueLessOrEqual') },
  ];
  pageViewConditionalType = [
    { name: '=', value: this.$t('input.exactUrl') },
    { name: 'iLike', value: this.$t('input.valueContains') },
  ];

  action = '';
  eventType = '';
  time = '';
  timeCustom: any = '';
  showTime = false;
  showTimeCustom = false;
  showAction = false;
  showMessage = false;
  showType = false;
  selectedTime = '';
  selectedAction = '';
  selectedType = '';
  loadMenu = false;
  isFocused = false;
  localSelectedAction = '';
  messageName = '';
  selectedMessage = '';

  beforeMount() {
    if (this.$props.type !== 'automations') {
      this.actionsTypes.push({ name: 'anyChannel', value: this.$t('title.anyChannels') });
      this.actionsTypes.push({ name: 'page_view', value: this.$t('input.website') });
    }
    this.findMessage();
    const step = this.$props.step;
    this.eventType = step?.event_type || 'email';
    this.selectedType = this.actionsTypes.find((x: any) => x.name === this.eventType)?.value;
    this.updateType('event_type', this.eventType);
    this.action = step?.event || '';
    const typeAction = step.conditional_interation === 'not' ? 'no' : '';
    this.localSelectedAction = this.actions.find(
      (x: any) => x.name === this.action && x.value.includes(typeAction)
    )?.value;
    this.selectedAction = this.localSelectedAction ? (this.$t(`input.${this.localSelectedAction}`) as string) : '';
    this.time = step?.time || '';
    this.selectedTime = this.timeType.find((x: any) => x.name === this.time)?.value;
    this.selectedTime = !this.selectedTime && this.time ? (this.$t('input.custom') as string) : this.selectedTime;
    this.timeCustom = this.selectedTime === this.$t('input.custom') ? this.time : '';
    this.showTimeCustom = this.timeCustom ? true : false;
    if (!step?.message) {
      this.updateStep('message', 'any');
    }
    this.selectedMessage =
      !step?.message || step?.message === 'any' ? this.$t('input.anyMessage') : step?.message.title;
    this.updateStep('custom_times_value', step.custom_times_value || 1);
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
    if (time > 180) {
      this.timeCustom = 180;
      time = 180;
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.customBiggerThan90') as string,
      });
    }
    this.timeCustom = time;
    this.updateStep('time', this.timeCustom || 0);
  }
  changeType(index: number) {
    this.eventType = this.actionsTypes[index].name;
    this.selectedType = this.actionsTypes[index].value;
    this.showType = false;
    this.updateType('event_type', this.eventType);
    this.updateStep('event_type', this.eventType);

    this.messageName = '';
    this.selectedMessage = '';
    this.findMessage();
  }
  changeAction(index: number) {
    this.action = this.actions[index].name;
    this.localSelectedAction = this.actions[index].value;
    this.selectedAction = this.localSelectedAction ? (this.$t(`input.${this.localSelectedAction}`) as string) : '';
    this.showAction = false;

    let conditional = '';

    if (this.localSelectedAction.startsWith('no')) {
      conditional = 'not';
      this.updateStep('custom_times_value', 1);
    } else {
      conditional = 'yes';
    }
    this.updateStep('event', this.action);
    this.updateStep('conditional_interation', conditional);
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
  timeAll() {
    this.updateStep('time', 'all');
  }
  updateType(key: string, value: string) {
    let objectType: any = {};
    switch (this.eventType) {
      case 'email':
        objectType = InterationEmailTypes;
        break;
      case 'web-push':
        objectType = InterationPushTypes;
        break;
      case 'mobile-push':
        objectType = InterationPushTypes;
        break;
      case 'sms':
        objectType = InterationSmsTypes;
        break;
      case 'whatsapp':
        objectType = InterationWhatsappTypes;
        break;
      case 'page_view':
        objectType = InterationPageViewTypes;
        break;
    }
    this.actions = [];
    const keys = Object.keys(objectType);
    keys.forEach((keyInteration: string) => {
      this.actions.push({
        name: objectType[keyInteration] as string,
        value: keyInteration.toLowerCase(),
      });
    });
    this.updateStep(key, value);
  }

  async findMessage(search?: string): Promise<any> {
    try {
      const response: any = await this.messagesService.getMessages({
        title: search || '',
        page: 1,
        type: this.eventType || 'email',
        itemsPerPage: 10,
      });
      this.messages = response.data?.results.map((message: any) => {
        return {
          id: message.id,
          title: message.title,
          name: message.name,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  selectMessage(messageId: number | undefined, messageName: string | undefined, messageTitle: string | undefined) {
    this.showMessage = false;
    this.selectedMessage = messageName === 'any' ? (this.$t('input.anyMessage') as string) : messageTitle || '';
    const messageObj =
      messageId !== undefined
        ? {
            id: messageId,
            name: messageName,
            title: messageTitle,
          }
        : messageName;
    this.updateStep('message', messageObj || '');
  }

  @Watch('showMessage')
  focusOnInput(newValue: boolean) {
    this.$nextTick(() => {
      const inputElement = this.$refs.messagesMenu as HTMLElement | null;

      if (this.showMessage === true && inputElement) {
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
.list-item-block {
  display: inline-block;
  text-align: center;
  width: 100%;
}
.v-list-input {
  border-width: 1px;
  border-style: solid;
  padding: 0.5rem 0px;
  border-radius: 10px;
  width: 150px;
  text-align: center;
}
.group-input label {
  display: block;
}
.v-menu-btn {
  height: 33px !important;
  background-color: white !important;
  box-shadow: none;
  border: 1px solid $neutral-gray-500;
  text-transform: none;
  font-size: 12px !important;
  letter-spacing: none;
  width: 213px;
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
  width: 176px;
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

.message-card {
  background-color: #ffffff;
  width: -webkit-fill-available;
}

.input-message {
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

.message-div {
  border-bottom: 1px solid $ds-blue;
  border-radius: 8px !important;
}

.messages-list-folder {
  max-height: 200px;
  overflow-y: scroll;
}

.message-list {
  border-top: 1px solid #d9d9d9;
  height: 36px;
  padding-left: 11px !important;
  align-items: center;
}

.message-list:first-child {
  border-top: none;
}

.second-line-interactions {
  margin-top: 10px;
  margin-left: -16px;
}
</style>
