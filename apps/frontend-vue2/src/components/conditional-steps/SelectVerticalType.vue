<template>
  <div class="d-flex">
    <SelectConditionalComponent
      @updateStep="updateStep"
      :color="'select-light-purple'"
      :items="conditionalUserFields"
      :conditionalName="'conditional_user_field'"
      :value="step.conditional_user_field || '='"
    />

    <LineComponent :type="'vertical'" />
    <div>
      <v-menu
        ref="menu"
        v-model="showUserFilter"
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
            :class="{ 'select-button-open': showUserFilter === true }"
            v-on="on"
            @click="showUserFilter = true"
          >
            <div class="menu" v-on="on">
              <p :class="{ 'menu-open': showUserFilter === true }" style="display: flex; flex-direction: row">
                {{ selectedUserFilter || $t('input.select') }}
              </p>
            </div>
            <div>
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown  ds-blue-color': showUserFilter === true }"
                >arrow_drop_down</span
              >
            </div>
          </v-btn>
        </template>
        <v-card width="283" class="select-card" :class="{ 'select-card-open': showUserFilter === true }">
          <div class="select-options" v-for="(filter, index) in listFilters" :value="filter.name" :key="filter.name">
            <div class="option" @click="changeUserFilter(index)" :class="!listFilters[index + 1] ? 'last-item' : ''">
              {{ filter.value }}
            </div>
          </div>
        </v-card>
      </v-menu>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import LineComponent from './LineComponent.vue';

@Component({
  components: { SelectConditionalComponent, LineComponent },
  props: ['step'],
})
export default class CommunicationChannelsComponent extends Vue {
  userFilter = '';
  showUserFilter = false;
  selectedUserFilter: any = '';

  conditionalUserFields = [
    { name: '=', value: this.$t('input.like') },
    { name: '!=', value: this.$t('input.different') },
  ];

  listFilters = [
    { name: 'cc', value: this.$t('automation.creditCard') },
    { name: 'emp', value: this.$t('automation.loan') },
  ];

  beforeMount() {
    const step = this.$props.step;
    this.userFilter = step?.user_field_value || '';
    this.selectedUserFilter = this.listFilters.find((x: any) => x.name === this.userFilter)?.value;
  }

  updateStep(key: string, value: string) {
    this.$emit('updateStep', key, value);
  }

  changeUserFilter(index: number) {
    this.showUserFilter = false;
    this.userFilter = this.listFilters[index].name as string;
    this.selectedUserFilter = this.listFilters[index].value as string;
    this.updateStep('user_field_value', this.userFilter);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 226px;
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
  width: 226px;
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
</style>
