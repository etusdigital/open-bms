<template>
  <div class="group-input">
    <v-menu
      ref="menu"
      v-model="show"
      class="select-menu"
      :class="color || 'select-purple'"
      :close-on-content-click="false"
      bottom
      transition="scale-y-transition"
      offset-y
      :width="customWidth + 'px'"
      :disabled="disabled"
    >
      <template v-slot:activator="{ on }">
        <v-btn
          class="select-button"
          :class="[{ 'select-button-open': show === true }, `${color || 'select-purple'}-button`]"
          v-on="on"
          @click="show = true"
          :width="customWidth + 'px'"
          :disabled="disabled"
        >
          <div class="menu" v-on="on">
            <p :class="{ 'menu-open': show === true }" style="display: flex; flex-direction: row">
              {{ selectedValue }}
            </p>
          </div>
          <div>
            <span
              class="material-symbols-rounded icon-up"
              :class="[{ 'icon-dropdown': show === true }, `${color || 'select-purple'}-icon`]"
            >
              arrow_drop_down
            </span>
          </div>
        </v-btn>
      </template>
      <v-card
        class="select-card"
        :class="[`${color || 'select-purple'}-card`, ...(show ? [`${color || 'select-purple'}-open`] : [])]"
      >
        <div
          :class="[show === true ? `${color || 'select-purple'}-open` : '']"
          v-for="(item, index) in items"
          :value="item.name"
          :key="item.name"
        >
          <div
            class="option"
            @click="changeValue(index)"
            :class="(!items[index + 1] ? 'last-item' : '') + ' ' + color || 'select-purple' + '-option'"
          >
            {{ item.value }}
          </div>
        </div>
      </v-card>
    </v-menu>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({
  props: ['indexCard', 'color', 'items', 'conditionalName', 'value', 'disabled', 'selectedColor'],
})
export default class SelectConditionalComponent extends Vue {
  @Prop() indexCard!: number;
  @Prop() color!: string;
  @Prop() items!: any;
  @Prop() conditionalName!: string;
  @Prop() value!: string;
  @Prop() disabled!: boolean;
  @Prop() selectedColor!: any;

  customWidth = 60;
  show = false;
  defaultValue = '';
  selectedValue = '';
  mounted() {
    this.makeElementsSameSize();
  }

  makeElementsSameSize() {
    let maxLength = 0;
    this.items.forEach((value: any) => {
      if (value.value.length > maxLength) {
        maxLength = value.value.length;
      }
    });
    this.customWidth = (maxLength * 80) / 16 + 80;
    if (this.customWidth < 60) {
      this.customWidth = 60;
    }
  }
  changeValue(index: number) {
    this.show = false;
    this.selectedValue = this.items[index].value;
    this.updateStep(this.items[index].name);
  }
  updateStep(value: string) {
    this.$emit('updateStep', this.$props.conditionalName, value, this.$props.indexCard);
  }
  beforeMount() {
    this.defaultValue = this.$props.value;
    this.selectedValue = this.items.find((x: any) => x.name === this.$props.value)?.value;
    this.updateStep(this.defaultValue);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.group-input {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
::v-deep.v-btn:not(.v-btn--round).v-size--default {
  min-width: 60px;
  width: max-content;
  max-width: 176px;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-light-purple-button,
.select-light-purple-button.v-btn--disabled.v-btn--has-bg,
.select-purple-open {
  background-color: #d0c9f8 !important;
  border: 1px solid $ds-purple;
}
.select-purple-button,
.select-purple-button.v-btn--disabled.v-btn--has-bg {
  background-color: $ds-purple !important;
  border: 1px solid #604bcc;
  opacity: 1;
  width: 100% !important;
  > .v-btn__content .menu p {
    font-weight: bold;
  }
}
.select-card {
  border-radius: 0px 0px 8px 8px !important;
  background-color: #d0c9f8 !important;
  width: 100% !important;
  color: #fff !important;
  font-size: 12px !important;
  font-weight: normal !important;
  line-height: 18px !important;
  letter-spacing: 0em !important;
  text-align: left !important;
}
.select-light-orange-card,
.select-orange-button,
.select-orange-open {
  border-bottom: 1px solid #ff9654;
  border-top: 1px solid #ff9654;
  border-right: 1px solid #ff9654;
  border-left: 1px solid #ff9654;
  background-color: #ff9654 !important;
}
.select-orange-open:hover {
  background-color: #ff9654 !important;
}
.button-orange {
  background-color: #ff9654 !important;
}
.button-purple {
  background-color: #7b61ff !important;
}
.select-light-purple-card {
  background-color: #d0c9f8 !important;

  .select-options {
    border-bottom: 1px solid $ds-purple !important;
  }

  .option {
    border-top: 1px solid $ds-purple !important;
    padding: 8px;
    background-color: #d0c9f8 !important;
    width: 100% !important;
    color: #000 !important;
    font-size: 12px;
    font-weight: normal;
    line-height: 18px;
    letter-spacing: 0em;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: $ds-purple !important;
    }
  }
}
.select-purple-card {
  background-color: $ds-purple !important;

  .select-options {
    border-bottom: 1px solid #604bcc !important;
  }

  .option {
    background-color: $ds-purple !important;
    width: 100% !important;

    &:hover {
      background: #604bcc !important;
    }
  }
}
.select-options {
  border-bottom: 1px solid #328d3e;
}

.select-options-orange {
  border-bottom: 1px solid #ff9654 !important;
}

.select-options-purple {
  border-bottom: 1px solid #7b61ff !important;
}

.option-orange {
  border-top: 1px solid #ff9654 !important;
}

.option-purple {
  border-top: 1px solid #7b61ff !important;
}

.select-orange-option {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding: 8px;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: #ffffff;
  &:hover {
    background: #d17a44 !important;
  }
}
.select-purple-option,
.select-light-purple-option {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding: 8px;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: #ffffff;
  border-top: 1px solid #604bcc !important;
  background-color: $ds-purple !important;
  &:hover {
    background: #604bcc !important;
  }
}

.last-item {
  border-radius: 0px 0px 8px 8px !important;
}

.select-button {
  min-width: 60px;
  width: max-content;
  max-width: 283px;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px !important;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  box-shadow: none;
  overflow: unset !important;
  &:disabled {
    opacity: 0.5;
  }
}

::v-deep .theme--light.v-btn.v-btn--disabled.v-btn--has-bg {
  background-color: rgba(0, 0, 0, 0) !important;
}

.select-light-purple-button {
  p {
    color: #000 !important;
  }
}

.v-btn--disabled {
  background-color: rgba(0, 0, 0, 0) !important;
}
.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid #328d3e;
  border-right: 1px solid #328d3e;
  border-left: 1px solid #328d3e;
}
~ .select-light-purple-card.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-purple;
  border-right: 1px solid $ds-purple;
  border-left: 1px solid $ds-purple;
}
.select-purple-card.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid #604bcc;
  border-right: 1px solid #604bcc;
  border-left: 1px solid #604bcc;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
}

.select-button-open-orange {
  border-bottom: 1px solid #ff9654;
  border-top: 1px solid #ff9654;
  border-right: 1px solid #ff9654;
  border-left: 1px solid #ff9654;
}
.select-button-open-purple {
  border-bottom: 1px solid #7b61ff;
  border-top: 1px solid #7b61ff;
  border-right: 1px solid #7b61ff;
  border-left: 1px solid #7b61ff;
}

.select-light-purple-button.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-purple;
  border-top: 1px solid $ds-purple;
  border-right: 1px solid $ds-purple;
  border-left: 1px solid $ds-purple;
}
.select-purple-button.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid #604bcc;
  border-top: 1px solid #604bcc;
  border-right: 1px solid #604bcc;
  border-left: 1px solid #604bcc;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  width: max-content;
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
    color: #ffffff;
  }
}

.icon-up {
  color: #ffffff !important;
}

.icon-up.select-light-purple-icon {
  color: #000 !important;
}
</style>
