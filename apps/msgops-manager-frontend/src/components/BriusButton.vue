<script setup lang="ts">
interface BriusButtonProps {
  type?: 'button' | 'reset' | 'submit';
  variant?: 'primary' | 'secondary' | 'delete';
  name: string;
  successMessage?: string;
  disabled: boolean;
  placeholder?: string;
  click?: (payload: MouseEvent) => void;
}

const props = withDefaults(defineProps<BriusButtonProps>(), {
  type: 'button',
  disabled: false,
  variant: 'primary',
});

const styleButtonPrimary = {
  'tw-bg-primary': true,
  'tw-text-white': true,
};

const styleButtonSecondary = {
  'tw-bg-transparent': true,
  'tw-text-primary': true,
};

const styleButtonDelete = {
  'tw-bg-red': true,
  'tw-text-white': true,
};

const styleDisabledButton = {
  'tw-cursor-not-allowed': true,
  'tw-bg-gray-light': true,
  'tw-text-light': true,
  'tw-bg-opacity-80': true,
};

const getStyleVariant = (variant: BriusButtonProps['variant']) => {
  if (variant === 'secondary') {
    return styleButtonSecondary;
  }

  if (variant === 'delete') {
    return styleButtonDelete;
  }

  return styleButtonPrimary;
};

const getStyleDisabled = (disabled: boolean) => {
  if (disabled) return styleDisabledButton;
  return {};
};
</script>

<template>
  <button
    :id="props.name"
    :name="props.name"
    :type="type"
    :disabled="props.disabled"
    class="tw-relative tw-inline-flex tw-h-9 tw-min-w-[64px] tw-flex-base tw-cursor-pointer tw-items-center tw-rounded-lg tw-py-2 tw-px-6 tw-align-middle tw-text-sm tw-font-bold tw-tracking-wider tw-uppercase hover:tw-bg-opacity-80 active:tw-shadow-md"
    :class="{ ...getStyleVariant(props.variant), ...getStyleDisabled(props.disabled) }"
    @click="props.click"
  >
    <span class="tw-relative tw-flex tw-flex-secondary">
      <slot></slot>
    </span>
  </button>
</template>
