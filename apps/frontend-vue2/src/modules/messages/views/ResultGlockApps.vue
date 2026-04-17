<template>
  <div class="view-deliverabity-test">
    <h2 class="c-title pl-4 pb-0">{{ $t('datatable.deliverabilityTest') }}</h2>
    <ResultTest
      :messages="messages"
      :fixMessage="fixMessage"
      :mailTrigger="selectedMailTrigger"
      :active="false"
      :messageId="messageId"
    >
    </ResultTest>
  </div>
</template>

<script lang="ts">
import ResultTest from '@/components/glockapps/ResultTest.vue';
import { MailTriggerEnum } from '@/enums/mail-trigger.enum';
import CampaignService from '@/services/campaign.service';
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import { MessageDto } from '../dtos/message.dto';
import MessageService from '../services/messages.service';

@Component({
  components: { ResultTest },
  providers: [CampaignService, LoadingService],
})
export default class ResultGlockApps extends Vue {
  private readonly loadingService = new LoadingService();
  private readonly messagesService = new MessageService();

  public messages: MessageDto[] = [];
  public messageId?: any;

  selectedMailTrigger: MailTriggerEnum = MailTriggerEnum.ACTIVE_CAMPAIGN;

  async beforeMount() {
    this.loadingService.show();
    this.messageId = this.$route.params.message_id;

    const message = await this.messagesService.getMessageById(this.messageId);
    this.messages.push({
      id: message.data.id,
      subject: message.data.subject,
      content: message.data.content,
      text: message.data.text,
      fromMail: message.data.fromMail,
      fromName: message.data.fromName,
      version: 1,
      accounts: message.data.automationMessageAccount,
      isTested: message.data.isTested,
    });
    this.loadingService.hide();
  }

  async fixMessage() {
    await this.$router.push(`/messages/email/${this.messageId}`);
  }

  beforeDestroy() {}
}
</script>

<style scoped lang="scss">
::v-deep.view-deliverabity-test {
  width: 100%;
}
</style>
