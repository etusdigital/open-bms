<template>
  <v-btn class="button" @click="$emit('click')" :to="to" :type="type" :loading="loading">
    {{ name }}
  </v-btn>
</template>

<script lang="ts">
export default {
  name: 'ButtonDefault',
  props: {
    name: String,
    functionName: String,
    to: String,
    loading: Boolean,
    type: {
      type: String,
      default: 'button',
    },
  },
};
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.button {
  background: $ds-blue !important;
  border-radius: 8px !important;
  padding: 10px 30px !important;
  color: #ffffff !important;
  opacity: 1 !important;

  &:hover {
    background: $ds-blue-dark !important;
  }
}

.button-outlined {
  border: $ds-blue 2px solid !important;
  color: $ds-blue !important;
  background-color: $ds-gray-100 !important;

  &:hover {
    background: $ds-blue !important;
    color: #ffffff !important;
  }
}

.button-small {
  font-size: 10px !important;
  font-weight: 700 !important;
  line-height: 10px !important;
  letter-spacing: 0.07em !important;
  text-align: center !important;
  gap: 10px !important;
  background: $ds-blue !important;
  border-radius: 8px !important;
  padding: 8px 12px 8px 12px !important;
  color: $neutral-basic-white !important;
  opacity: 1 !important;

  &:hover {
    background: $ds-blue-dark !important;
  }
}
.button-link-small {
  color: $ds-blue !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  line-height: 15px !important;
  letter-spacing: 0.07em !important;
  text-align: center !important;
  background-color: transparent !important;
  box-shadow: none !important;

  &:hover {
    color: $ds-blue-dark !important;
    background-color: transparent !important;
  }
}
.button-outlined-small {
  font-size: 10px !important;
  font-weight: 700 !important;
  line-height: 10px !important;
  letter-spacing: 0.07em !important;
  text-align: center !important;
  padding: 8px 12px 8px 12px !important;
  border: $ds-blue 1px solid !important;
  color: $ds-blue !important;
  background-color: transparent !important;

  &:hover {
    background: $ds-blue !important;
    color: $neutral-basic-white !important;
  }
}
.button-outlined-cancel-small {
  font-size: 10px !important;
  font-weight: 700 !important;
  line-height: 10px !important;
  letter-spacing: 0.07em !important;
  text-align: center !important;
  padding: 8px 12px 8px 12px !important;
  border: $ds-red 1px solid !important;
  color: $ds-red !important;
  background-color: transparent !important;
  &:hover {
    color: $neutral-basic-white !important;
    background-color: $ds-red !important;
  }
}
::v-deep.button .disabled,
:disabled {
  background: $ds-gray-300 !important;
  border: 0px !important;
}

.c-title.disabled,
:disabled {
  color: $ds-gray-400 !important;
}
</style>
