<template>
  <div class="d-flex" v-if="render">
    <div class="group-input w-50 mr-3">
      <label>{{ $t('datatable.initialTime') }}</label>
      <input
        type="number"
        class="form-control"
        v-model="initialTime"
        :placeholder="`${$t('input.time')}`"
        min="1"
        @input="updateData"
      />
    </div>
    <label class="mr-3 mt-auto">{{ $t('datatable.to') }}</label>
    <div class="group-input w-50">
      <label>{{ $t('datatable.endTime') }}</label>
      <input
        type="number"
        class="form-control"
        v-model="endTime"
        :placeholder="`${$t('input.time')}`"
        min="1"
        @input="updateData"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';

@Component({
  components: {},
  computed: {
    ...mapState(['userLanguage']),
  },
  props: ['render', 'step'],
})
export default class ConditionalTimeComponent extends Vue {
  @Prop() step!: any;
  @Prop() render!: boolean;
  userLanguage!: string;
  initialTime = '';
  endTime = '';
  isLanguageEnUs = false;

  beforeMount() {
    this.isLanguageEnUs = this.userLanguage === 'en-US';
    this.showModal();
  }

  hideModal() {
    this.$emit('hideModal');
  }

  updateData() {
    this.$emit('updateInfo', { initialTime: this.initialTime, endTime: this.endTime });
  }

  @Watch('render')
  showModal() {
    if (this.render) {
      this.initialTime = this.step?.settings?.initialTime || '';
      this.endTime = this.step?.settings?.endTime || '';
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
</style>
