<script setup lang="ts">
import { toRef } from 'vue';
import { useField } from 'vee-validate';
import { ChevronDownOutline } from '@vicons/ionicons5';

interface BriusTextFieldProps {
  value?: string;
  name: string;
  label: string;
  successMessage?: string;
  multiple?: boolean;
  placeholder?: string;
}

const props = withDefaults(defineProps<BriusTextFieldProps>(), { value: '', placeholder: '' });

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
</script>

<template>
  <div class="tw-mb-4">
    <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" :for="name">{{ label }}</label>

    <div class="tw-relative tw-inline-block tw-w-64">
      <select
        :id="name"
        :name="name"
        :value="inputValue"
        :placeholder="placeholder"
        :multiple="multiple"
        class="focus:tw-shadow-outline tw-flex tw-w-full tw-appearance-none tw-items-center tw-rounded-lg tw-border tw-border-gray-light tw-px-3 tw-py-2 tw-pr-4 tw-leading-tight tw-text-main-gray tw-shadow focus:tw-outline-none"
        @input="handleChange"
        @blur="handleBlur"
      >
        <slot></slot>
      </select>

      <div class="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-2 tw-flex tw-w-4 tw-items-center">
        <ChevronDownOutline color="#5C5C5C" />
      </div>
    </div>

    <p v-if="errorMessage && meta.touched" class="tw-text-xs tw-text-gray" :class="{ 'tw-text-red': !!errorMessage }">
      {{ errorMessage || successMessage }}
    </p>
  </div>
</template>
