<template>
  <div class="view-user-fields-step d-flex">
    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block">{{ $t('title.field') }}</label>
      </div>
      <div>
        <v-menu
          ref="menu"
          v-model="showUserField"
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
              :class="{ 'select-button-open': showUserField === true }"
              v-on="on"
              @click="showUserField = true"
            >
              <div class="menu" v-on="on">
                <p :class="{ 'menu-open': showUserField === true }" style="display: flex; flex-direction: row">
                  {{ selectedUserFiled || $t('input.select') }}
                </p>
              </div>
              <div>
                <span
                  class="material-symbols-rounded icon-up"
                  :class="{ 'icon-dropdown  ds-blue-color': showUserField === true }"
                >
                  arrow_drop_down
                </span>
              </div>
            </v-btn>
          </template>
          <v-card width="283" class="select-card" :class="{ 'select-card-open': showUserField === true }">
            <div
              class="select-options"
              v-for="(userField, index) in listUserFields"
              :value="userField.name"
              :key="userField.name"
            >
              <div
                class="option"
                @click="changeUserField(index)"
                :class="!listUserFields[index + 1] ? 'last-item' : ''"
              >
                {{ userField.value }}
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>
    <LineComponent :type="'vertical'" />

    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block">
          {{ $t('title.filter') }}
        </label>
      </div>
      <div v-if="userFieldKey === ''" class="d-flex">
        <div>
          <v-menu
            ref="menu"
            class="select-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
          >
            <template v-slot:activator="{ on }">
              <v-btn class="select-button select-light-purple-button" v-on="on">
                <div class="menu" v-on="on">
                  <p style="display: flex; flex-direction: row" class="p-light-purple">
                    {{ $t('input.select') }}
                  </p>
                </div>
                <div>
                  <span class="material-symbols-rounded icon-up-light-purple">arrow_drop_down</span>
                </div>
              </v-btn>
            </template>
          </v-menu>
        </div>
        <LineComponent :type="'vertical'" />
        <input type="text" class="form-control" disabled />
      </div>
      <EntryUserField
        :step="step"
        @updateStep="updateStep"
        :selectedConditional="step.conditional_user_field"
        v-if="userFieldKey === userField.ENTRY || userFieldKey === userField.AUTOMATION_ENTRY"
      />
      <EmailProviderField
        :step="step"
        @updateStep="updateStep"
        :selectedConditional="step.conditional_user_field"
        v-if="userFieldKey === userField.EMAIL_PROVIDER"
      />
      <CommunicationChannelsComponent
        :step="step"
        @updateStep="updateStep"
        :selectedConditional="step.conditional_user_field"
        v-if="userFieldKey === userField.COMMUNICATION_CHANNELS"
      />
      <SelectConditionalComponent
        @updateStep="updateStep"
        :color="'select-light-purple'"
        :items="conditionalUserFields"
        :conditionalName="'conditional_user_field'"
        :value="step.conditional_user_field || '='"
        v-if="
          [
            userField.EMAIL_DELIVERABLE,
            userField.EMAIL_BOUNCED,
            userField.EMAIL_UNSUBSCRIBED,
            userField.ACTIVE,
            userField.EMAIL_VALID,
          ].includes(userFieldKey)
        "
      />
      <SelectVerticalType
        :step="step"
        @updateStep="updateStep"
        :selectedConditional="step.conditional_user_field"
        v-if="userFieldKey === userField.LAST_VERTICAL_TYPE"
      />
    </div>
    <div class="div-trash ml-2">
      <button class="ml-auto button-trash" @click="removeStep" type="button">
        <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { UserFieldsTypes } from '@/interfaces/step-conditional.interfaces';
import { Component, Prop, Vue } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import EmailProviderField from './addUserFieldsFilters/EmailProviderField.vue';
import EntryUserField from './addUserFieldsFilters/EntryUserField.vue';
import CommunicationChannelsComponent from './addUserFieldsFilters/CommunicationChannelsComponent.vue';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import SelectVerticalType from './SelectVerticalType.vue';

@Component({
  components: {
    CommunicationChannelsComponent,
    LineComponent,
    EmailProviderField,
    EntryUserField,
    SelectConditionalComponent,
    SelectVerticalType,
  },
  props: ['step', 'type'],
})
export default class AddUserFieldsComponent extends Vue {
  @Prop() type!: string;
  public userField = UserFieldsTypes;
  userFieldKey = '';
  showUserField = false;
  selectedUserFiled: any = '';

  listUserFields = [
    { name: UserFieldsTypes.ENTRY, value: this.$t('input.entry') },
    { name: UserFieldsTypes.AUTOMATION_ENTRY, value: this.$t('input.automationEntry') },
    { name: UserFieldsTypes.EMAIL_PROVIDER, value: this.$t('input.emailProvider') },
    { name: UserFieldsTypes.COMMUNICATION_CHANNELS, value: this.$t('input.communicationChannels') },
    { name: UserFieldsTypes.LAST_VERTICAL_TYPE, value: this.$t('input.lastVerticalType') },
    // { name: UserFieldsTypes.EMAIL_UNSUBSCRIBED, value: this.$t('input.unsubscribed') },
    // { name: UserFieldsTypes.EMAIL_BOUNCED, value: this.$t('input.bounced') },
    // { name: UserFieldsTypes.ACTIVE, value: this.$t('input.active') },
  ];

  conditionalUserFields = [
    { name: 'true', value: this.$t('input.yes') },
    { name: 'false', value: this.$t('input.no') },
  ];

  beforeMount() {
    if (this.type !== 'automations') {
      this.listUserFields.push({ name: UserFieldsTypes.EMAIL_DELIVERABLE, value: this.$t('input.emailDeliverable') });
    }
    const step = this.$props.step;
    this.userFieldKey = step?.user_field_key || '';
    this.selectedUserFiled = this.listUserFields.find((x: any) => x.name === this.userFieldKey)?.value;
  }
  removeStep() {
    this.$emit('removeStep');
  }
  updateStep(key: string, value: string) {
    this.$emit('updateStep', key, value);
    if (key === 'user_field_key') {
      this.$emit('updateStep', 'user_field_value', '');
    }
  }
  changeUserField(index: number) {
    this.selectedUserFiled = this.listUserFields[index].value;
    this.userFieldKey = this.listUserFields[index].name;
    this.showUserField = false;
    this.updateStep('user_field_key', this.userFieldKey);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.filter {
  background-color: #d0c9f8 !important;
  color: #ffffff;
  font-weight: 500;
  margin-top: auto;
}

label {
  color: $ds-gray !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}
.custom-select-date {
  max-height: 38px;
}

.v-select-date {
  max-width: 150px;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  min-width: 176px;
  width: fit-content;
  max-width: 216px;
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

.select-light-purple-button {
  background-color: #d0c9f8 !important;
  border: 1px solid $ds-purple;

  p {
    color: #000 !important;
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

.p-light-purple {
  color: #ffffff !important;
}

.icon-up {
  color: $ds-gray;
}

.icon-up-light-purple {
  color: #000 !important;
}

.div-trash {
  display: flex;
  align-items: flex-end;
}
</style>
