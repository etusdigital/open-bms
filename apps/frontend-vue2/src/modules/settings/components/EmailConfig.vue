<template>
  <div>
    <div>
      <label class="label-title pb-0 font-16">{{ $t('button.general') }}</label>
      <v-card class="background-card message-form mt-0">
        <div class="div-input-params w-25">
          <InputDefault
            data-cy="rate-limit-user"
            :name="`${$t('input.userRateLimit')}`"
            :type="'number'"
            :modelValue="limitSettings"
            :placeholder="$t('input.typeHere')"
            @updateInput="updateInput"
          />
        </div>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '../../../components/button/ButtonDefault.vue';
import InputDefault from '../../../components/input/InputDefault.vue';

@Component({
  components: { ButtonDefault, InputDefault },
  props: ['rateLimitUser'],
})
export default class EmailConfig extends Vue {
  @Prop() rateLimitUser!: any;

  limitSettings: any = 0;

  beforeMount() {
    this.limitSettings = this.rateLimitUser ?? 0;
  }

  updateInput(value: undefined) {
    this.limitSettings = value;
    this.$emit('updateSendUserLimit', value);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep.v-card {
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06) !important;
}

.message-form {
  padding: 20px;
}
</style>
