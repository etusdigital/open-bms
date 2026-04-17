<template>
  <div class="view-deliverabity-test">
    <h2 class="c-title pl-4 pb-0">{{ $t('title.deliverability') }}</h2>
    <h4 class="c-subtitle col-12" v-if="statusTest !== StatusDeliverabilityTest.InProgress">
      {{ $t('title.recommend') }}
    </h4>
    <a class="btn-back" v-if="statusTest !== StatusDeliverabilityTest.InProgress" @click="buttonBack()">
      <span class="material-symbols-rounded"> arrow_back </span> {{ $t('button.return') }}
    </a>

    <div class="col-6 offset-3 form-field test-accounts mb-0">
      <div class="test-label">
        <label class="pb-0 mt-0" for="test-accounts">{{ $t('title.sendingProvider') }}</label>
      </div>

      <v-select
        v-model="selectedSendProvider"
        class="mt-0"
        :items="sendProviders"
        item-text="label"
        item-value="value"
        :label="`${$t('title.selectProvider')}`"
        persistent-hint
        return-object
        single-line
        :disabled="statusTest == StatusDeliverabilityTest.InProgress"
      ></v-select>
    </div>

    <div class="col-6 offset-3 form-field test-accounts">
      <div class="test-label">
        <label class="pb-0 mt-0" for="test-accounts">{{ $t('title.selectTest') }}</label>
      </div>

      <v-select
        v-model="selectedSendTest"
        :items="sendTests"
        class="mt-0"
        item-text="label"
        item-value="value"
        :label="`${$t('title.selectType')}`"
        persistent-hint
        return-object
        single-line
        :disabled="statusTest == StatusDeliverabilityTest.InProgress"
      ></v-select>
    </div>

    <CreateTest
      :doTest="doTest"
      :afterTestRoute="'deliverability-test-result'"
      :skipTestRoute="'/messages/email'"
      @onSkipTest="onSkipTest"
      @onChangeStatusTest="onChangeStatusTest"
      :disableTestButton="!selectedSendProvider"
    >
    </CreateTest>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import CreateTest from '@/components/glockapps/CreateTest.vue';
import { StatusDeliverabilityTest } from '@/components/glockapps/enums/status-test.enum';
import MessagesService from '../services/messages.service';
import MessageApiService from '../services/message-api.service';
import LoadingService from '@/services/loading.service';
import { MailTriggerEnum } from '@/enums/mail-trigger.enum';
import Multiselect from 'vue-multiselect';
import ToastService from '@/services/toast.service';

@Component({
  components: { CreateTest, Multiselect },
  filters: {},
  computed: {},
})
export default class DeliverabilityTest extends Vue {
  StatusDeliverabilityTest: any = StatusDeliverabilityTest;
  statusTest: StatusDeliverabilityTest = StatusDeliverabilityTest.NotStarted;

  private readonly messagesService = new MessagesService();
  private readonly messageApiService = new MessageApiService();
  private readonly loadingService = new LoadingService();

  private readonly toastService = new ToastService();

  private message?: any;
  private messageId?: any;

  private accounts: any[] = [];
  private selectedAccounts: any = [];

  public sendProviders: any[] = [
    { label: 'Sendgrid', value: MailTriggerEnum.SENDGRID },
    { label: 'Sparkpost', value: MailTriggerEnum.SPARKPOST },
  ];
  public sendTests: any[] = [{ label: 'GlockApps', value: 'glockApps' }];
  public selectedSendProvider: any = 3;
  public selectedSendTest: any;

  beforeMount() {
    this.selectedSendTest = this.sendTests[0];
  }

  async mounted() {
    try {
      this.loadingService.show();
      this.messageId = this.$route.params.message_id;
      const message = await this.messagesService.getMessageById(this.messageId);
      this.message = message.data;
    } catch (err) {
      console.error(err);
    } finally {
      this.loadingService.hide();
    }
  }

  async buttonBack() {
    await this.$router.push(`/messages/email/${this.messageId}`);
  }

  async doTest() {
    try {
      this.loadingService.show();
      const messages = [
        {
          subject: this.message.subject,
          content: this.message.content,
          text: this.message.text,
          fromMail: this.message.fromMail,
          fromName: this.message.fromName,
          ipPool: this.message.ippool,
          version: 1,
          id: this.message.id,
        },
      ];

      await this.messageApiService.automationsCreateTests({
        triggerId: this.selectedSendProvider.value || this.selectedSendProvider,
        title: this.message.title,
        messages,
        provider: this.selectedSendTest.value,
      });

      this.toastService.show({
        type: 'success',
        text: this.$t('modal.testCreated') as string,
      });
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      this.loadingService.hide();
    }
  }

  onChangeStatusTest(statusTest: StatusDeliverabilityTest) {
    this.statusTest = statusTest;
  }

  onSkipTest() {
    this.messagesService.updateMessage({
      id: this.message.id,
      isTested: false,
    });
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep.view-deliverabity-test {
  width: 100%;

  label {
    margin-bottom: 4px !important;
  }
}

::v-deep.form-field {
  .multiselect,
  .test-label {
    margin: 0 auto;
  }
}
</style>
