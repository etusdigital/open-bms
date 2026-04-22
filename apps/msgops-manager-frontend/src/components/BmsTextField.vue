<script setup lang="ts">
import { ref, toRef, onMounted } from 'vue';
import { useField } from 'vee-validate';
import { useI18n } from 'vue-i18n';
import { RefreshOutline, Copy } from '@vicons/ionicons5';

interface BmsTextFieldProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value?: string;
  name: string;
  label: string;
  disabled?: boolean;
  password?: boolean;
  successMessage?: string;
  placeholder?: string;
  size?: number;
  characters?: string;
}

const { t } = useI18n();

const initialTooltipText = t('userPage.beforeCopy');
const tooltipText = ref(initialTooltipText);

const props = withDefaults(defineProps<BmsTextFieldProps>(), {
  type: 'text',
  value: '',
  placeholder: '',
  disabled: false,
  characters: '',
});

// Use `toRef` to create reactive references to `name` prop which is passed to `useField`
// this is important because vee-validte needs to know if the field name changes
// https://vee-validate.logaretm.com/v4/guide/composition-api/caveats
const name = toRef(props, 'name');

// We don't provide any rules here because we are using form-level validation
// https://vee-validate.logaretm.com/v4/guide/validation#form-level-validation

const {
  value: inputValue,
  errorMessage,
  handleBlur,
  handleChange,
  meta,
} = useField(name, undefined, {
  initialValue: props.value,
});

const styleDisabledInput = {
  'tw-cursor-not-allowed': true,
  'tw-bg-gray-light': true,
  'tw-text-light': true,
};

const getStyleDisabled = (disabled: boolean) => {
  if (disabled) return styleDisabledInput;
  return {};
};

const handleCopy = () => {
  navigator.clipboard.writeText(inputValue.value);
  tooltipText.value = t('userPage.afterCopy');

  setTimeout(() => {
    tooltipText.value = initialTooltipText;
  }, 3000);
};

const generatePassword = () => {
  const charactersArray = props.characters?.split(',');
  let characterSet = '';
  let newPassword = '';

  if (charactersArray) {
    if (charactersArray.indexOf('a-z') >= 0) characterSet += 'abcdefghijklmnopqrstuvwxyz';

    if (charactersArray.indexOf('A-Z') >= 0) characterSet += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    if (charactersArray.indexOf('0-9') >= 0) characterSet += '0123456789';

    if (charactersArray.indexOf('#') >= 0) characterSet += '![]{}()%&*$#^<>~@|';
  }

  if (props.size) {
    for (let i = 0; i < props.size; i++) {
      newPassword += characterSet.charAt(Math.floor(Math.random() * characterSet.length));
    }
  }

  inputValue.value = newPassword;
};

generatePassword();

onMounted(() => {
  inputValue.value = props.value;
});
</script>

<template>
  <div class="tw-mb-4">
    <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" :for="name">{{ label }}</label>

    <div class="tw-flex">
      <div
        class="focus:tw-shadow-outline tw-flex tw-w-full tw-border tw-border-gray-light tw-appearance-none tw-items-center tw-rounded-lg tw-py-2 tw-px-3 tw-leading-tight tw-text-main-gray tw-shadow focus:tw-outline-none"
        :class="{ ...getStyleDisabled(Boolean(disabled)) }"
      >
        <slot name="addon-before"></slot>
        <input
          :id="name"
          :name="name"
          :type="type"
          :value="inputValue"
          :placeholder="placeholder"
          :disabled="props.disabled"
          class="tw-bg-transparent tw-mr-3 tw-w-full tw-appearance-none tw-border-none tw-py-0.5 tw-text-xs tw-text-main-gray tw-leading-tight focus:tw-outline-none"
          :class="{ ...getStyleDisabled(Boolean(disabled)) }"
          @input="handleChange"
          @blur="handleBlur"
        />
        <button
          v-if="password"
          type="button"
          class="tw-bg-transparent tw-w-4 tw-flex-shrink-0 tw-rounded tw-border-4 -tw-mt-1"
          @click="generatePassword"
        >
          <RefreshOutline color="#A6A6A6" />
        </button>
      </div>
        <button v-if="password" type="button" class="tw-ml-2 tw-w-[18px]" @click="handleCopy">
          <v-tooltip activator="parent" location="top">{{ tooltipText }}</v-tooltip>
          <Copy color="#A6A6A6" />
        </button>
    </div>

    <p v-if="errorMessage && meta.touched" class="tw-text-xs tw-text-gray" :class="{ 'tw-text-red': !!errorMessage }">
      {{ errorMessage || successMessage }}
    </p>
  </div>
</template>
