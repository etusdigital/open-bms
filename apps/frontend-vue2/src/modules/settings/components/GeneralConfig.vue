<template>
  <div>
    <label class="label-title pb-0 font-16">{{ $t('datatable.accountInformation') }}</label>
    <v-card class="background-card message-form mt-0">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <InputDefault disabled name="time_zone" data-cy="time-zone" :modelValue="timeZone" />
        <InputDefault
          disabled
          name="unsubscribe_redirect_url"
          data-cy="unsubscribe-redirect-url"
          :modelValue="unsubscribeRedirectUrl"
        />
        <InputDefault disabled name="default_domain" data-cy="default-domain" :modelValue="accountDefaultDomain" />
      </div>
    </v-card>
  </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import InputDefault from '../../../components/input/InputDefault.vue';

@Component({
  components: { InputDefault },
  props: ['timeZone', 'unsubscribeRedirectUrl', 'accountDefaultDomain'],
})
export default class GeneralConfig extends Vue {
  @Prop() timeZone!: string;
  @Prop() unsubscribeRedirectUrl!: string;
  @Prop() accountDefaultDomain!: string;
}
</script>

<style>
.message-form {
  padding: 20px;
}
.label-title {
  color: #5c5c5c;
}
</style>
