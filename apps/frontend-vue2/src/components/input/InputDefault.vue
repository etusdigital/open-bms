<template>
  <div class="input-default-search">
    <div class="input-div">
      <div class="div-row gap-10 justify-space-between">
        <label v-if="name" class="name mb-1 label-title input-font" :style="{ fontSize: fontSize || '12px' }">
          {{ name }}
        </label>
        <span v-if="isMaxLength" class="font-10 ds-light-gray-color">{{ `${(value || '').length}/${max}` }}</span>
      </div>
      <v-text-field
        class="input-default"
        :placeholder="placeholder"
        outlined
        :value="$data.value"
        :disabled="disabled"
        @input="updateInput"
        background-color="#fff"
        :type="type ? type : hideText ? 'password' : 'text'"
        :prepend-inner-icon="''"
        @click:append="generate"
        :hint="hintText"
        persistent-hint
        :maxlength="max"
        hide-details="auto"
      >
        <v-btn
          v-for="(button, buttonIndex) in inputIcon"
          :key="'button' + buttonIndex"
          icon
          slot="append"
          alt="search icon"
          @click="buttonAction(button.action)"
        >
          <span
            class="material-symbols-rounded icon-color"
            :class="[button.type === 'unfilled' ? `unfilled-icon ${button.action}` : `${button.action}`]"
          >
            {{ button.icon }}
          </span>
        </v-btn>
        <v-btn v-if="prependIcon" icon slot="prepend-inner" alt="icon" @click="$emit('click')">
          <span class="material-symbols-rounded focus-icon"> {{ prependIcon }} </span>
        </v-btn>
      </v-text-field>
    </div>
    <v-btn class="button-copy" v-if="password" text icon color="blue lighten-2" @click="copyText()">
      <span class="material-symbols-rounded" title="Copiar">content_copy</span>
    </v-btn>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch, Prop } from 'vue-property-decorator';

@Component({
  name: 'InputDefault',
})
export default class InputDefault extends Vue {
  @Prop() public name!: string;
  @Prop() public placeholder!: string;
  @Prop() public disabled!: boolean;
  @Prop() public keyInput!: string;
  @Prop() public password!: boolean;
  @Prop() public email!: string;
  @Prop() public auto!: string;
  @Prop() public size!: string;
  @Prop() public characters!: string;
  @Prop() public hideText!: boolean;
  @Prop() public hintText!: string;
  @Prop() public inputIcon!: any;
  @Prop() public prependIcon!: string;
  @Prop() public max!: string;
  @Prop() public modelValue!: any;
  @Prop() public type!: string;
  @Prop() public tooltipIcon!: string;
  @Prop() public tooltipMessage!: string;
  @Prop() public defaultData!: string;
  @Prop() public fontSize!: string;
  @Prop() public isMaxLength!: boolean;

  beforeMount() {
    if (this.$props.auto === 'true' || this.$props.auto === 1) {
      this.generate();
    }
  }

  updateInput(event: any) {
    this.$data.value = event;
    this.$emit('updateInput', event, this.$props.keyInput, this.defaultData);
  }

  buttonAction(action: string) {
    this.$emit('buttonAction', action);
  }

  data() {
    return {
      value: this.$props.modelValue,
    };
  }

  generate() {
    const charactersArray = this.$props.characters.split(',');
    let characterSet = '';
    let password = '';

    if (charactersArray.indexOf('a-z') >= 0) {
      characterSet += 'abcdefghijklmnopqrstuvwxyz';
    }
    if (charactersArray.indexOf('A-Z') >= 0) {
      characterSet += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    if (charactersArray.indexOf('0-9') >= 0) {
      characterSet += '0123456789';
    }
    if (charactersArray.indexOf('#') >= 0) {
      characterSet += '![]{}()%&*$#^<>~@|';
    }

    for (let i = 0; i < this.$props.size; i++) {
      password += characterSet.charAt(Math.floor(Math.random() * characterSet.length));
    }
    this.$data.value = password;
    this.updateInput(password);
  }

  copyText() {
    navigator.clipboard.writeText(this.$data.value);
  }

  @Watch('modelValue')
  changeValue() {
    this.$data.value = this.$props.modelValue;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.input-font {
  color: #5c5c5c !important;
}
.input-default-search {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 5px;
  width: auto;
  flex: 1;
  min-width: fit-content;
}
.input-div {
  flex: 1;
}
.input-default {
  font-weight: 400;
  font-size: 12px;
  border-radius: 8px;
  width: auto;
  flex: 1;
  caret-color: $ds-blue;
}
.input-default:disabled {
  background-color: #e9ecef !important;
}

.tooltip-icon:hover {
  cursor: default;
}

.icon-color {
  color: $ds-gray-400;
}

::v-deep .v-input__prepend-inner {
  align-self: center !important;
  padding-left: 5px;
}

::v-deep.v-input--is-focused .focus-icon {
  color: $ds-blue !important;
}

::v-deep.name {
  display: block;
}
::v-deep.input {
  border-radius: 12px;
  background: #ffffff;
}

::v-deep.v-text-field__details {
  background-color: red !important;
}

::v-deep.v-input--is-focused fieldset {
  border-color: $ds-blue !important;
}

::v-deep.v-input .v-input__slot {
  padding: 0 !important;
}

::v-deep.v-input input {
  padding-left: 8px;
  padding-right: 8px;
}

::v-deep .v-input__append-inner,
::v-deep .v-input__prepend-inner {
  margin: 0 !important;
  align-items: center;
  display: contents;
}
</style>
