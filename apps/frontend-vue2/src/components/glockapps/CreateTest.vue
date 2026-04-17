<template>
  <div class="create-test">
    <section class="w-100 text-center">
      <div
        class="w-100"
        v-if="statusTest === StatusDeliverabilityTest.NotStarted || statusTest === StatusDeliverabilityTest.Ended"
      >
        <img class="large-img" src="@/assets/search-man.svg" alt="loading image" />
        <div>
          <button
            class="btn btn-c btn-lg btn-success btn-success-c btn-call-to-action"
            :disabled="statusTest === StatusDeliverabilityTest.InProgress || disableTestButton"
            data-cy="button-start-test"
            @click="startTest()"
          >
            {{ $t('button.testNow') }}
          </button>
          <button
            class="btn btn-c btn-lg btn-success btn-success-c btn-call-to-action float-right"
            v-if="statusTest === StatusDeliverabilityTest.NotStarted"
            data-cy="button-skip-test"
            @click="skipTest()"
          >
            {{ $t('button.skipTest') }}
          </button>
        </div>
      </div>

      <div class="w-100" v-show="statusTest === StatusDeliverabilityTest.InProgress">
        <img class="large-img" src="@/assets/search-man-animated.gif" alt="loading animated image" />
        <h6 class="c-subtitle">{{ $t('create.testRunning') }}</h6>
        <div class="inprogress-info d-flex justify-content-center">
          <p>{{ $t('create.showTest') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { StatusDeliverabilityTest } from '@/components/glockapps/enums/status-test.enum';
import ModalService from '@/services/modal.service';
import { Component, Vue } from 'vue-property-decorator';
import store from '@/store';
import Multiselect from 'vue-multiselect';

@Component({
  components: { Multiselect },
  providers: [ModalService],
  props: ['afterTestRoute', 'skipTestRoute', 'doTest', 'disableTestButton'],
  store,
  computed: {
    showSteps: {
      get() {
        return store.state.showSteps;
      },
      set(value) {
        store.commit('setShowSteps', value);
      },
    },
  },
})
export default class CreateTest extends Vue {
  StatusDeliverabilityTest: any = StatusDeliverabilityTest;
  statusTest: StatusDeliverabilityTest = StatusDeliverabilityTest.NotStarted;

  private readonly modalService = new ModalService();

  skipTest() {
    this.modalService.confirm({
      title: this.$t('modal.skipTest') as string,
      text: this.$t('modal.continue') as string,
      confirmLabel: this.$t('modal.skip') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.nextStep,
      isConfirm: true,
    });
  }

  async nextStep() {
    this.$emit('onSkipTest');
    await this.$router.push(this.$props.skipTestRoute);
  }

  async startTest() {
    try {
      this.statusTest = StatusDeliverabilityTest.InProgress;
      this.inProgressTest();
      await this.$props.doTest();

      this.statusTest = StatusDeliverabilityTest.Ended;
      this.endedTest();
      this.$router.push(this.$props.afterTestRoute);
    } catch (error) {
      this.statusTest = StatusDeliverabilityTest.NotStarted;
      this.endedTest();
    }
  }

  inProgressTest() {
    store.commit('setShowSteps', false);
    this.$emit('onChangeStatusTest', this.statusTest);
  }

  endedTest() {
    store.commit('setShowSteps', true);
    this.$emit('onChangeStatusTest', this.statusTest);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

h6 {
  font-style: normal;
  font-weight: normal;
  font-size: 20px;
  line-height: 24px;
  text-align: center;
  color: #020202;
}

p {
  font-size: 14px;
  margin-top: 16px;
  line-height: 17px;
  max-width: 420px;
}
</style>
