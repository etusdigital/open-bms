<template>
  <div class="view-campaign-content-step w-100 mt-2">
    <h5 class="title-message">{{ pageTitle[campaignType] }}</h5>
    <div class="d-block justify-center mt-2">
      <MessageCardComponent
        v-for="(currentMessage, indexMessage) in messages"
        :key="indexMessage"
        :message="currentMessage"
        :index="indexMessage"
        :messageType="messageType"
        :campaignType="campaignType"
        :messages="messages"
        @changeMessageStep="changeMessageStep"
        @removeCardMessage="removeCardMessage"
      />
      <div v-if="messages.length !== 4">
        <template v-if="[campaignsType.SPLIT, campaignsType.TESTAB].includes(campaignType) || !messages.length">
          <LineComponent :type="'horizontal'" v-if="messages.length" />
          <AddStepButtonComponent @addMessage="addMessage" class="text-center" />
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import AddStepButtonComponent from '@/components/add-step-button/AddStepButtonComponent.vue';
import MessageCardComponent from '../components/MessageCardComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import { CampaignsType } from '../enums/campaign.enum';

@Component({
  components: {
    AddStepButtonComponent,
    LineComponent,
    MessageCardComponent,
  },
  props: ['campaignType', 'messages', 'messageType'],
})
export default class ContentStep extends Vue {
  @Prop() public campaignType!: typeof CampaignsType[keyof typeof CampaignsType];
  @Prop() public messageType!: string;
  @Prop() public messages!: any;
  public campaignsType = CampaignsType;

  pageTitle = {
    [CampaignsType.SIMPLE]: this.$t('title.CampaignsTypeSimple'),
    [CampaignsType.TESTAB]: this.$t('title.CampaignsTypeTestAB'),
    [CampaignsType.SPLIT]: this.$t('title.CampaignsTypeSplit'),
    [CampaignsType.RECURRING]: this.$t('title.CampaignsTypeRecurring'),
  };
  addMessage() {
    this.$emit('addMessage');
  }
  removeCardMessage(index: number) {
    this.$emit('removeCardMessage', index);
  }
  changeMessageStep(index: number, message: any) {
    this.$emit('changeMessageStep', index, message);
  }
}
</script>

<style scoped lang="scss">
.title-message {
  display: flex;
  justify-content: center;
  margin-left: -360px;
  color: #5c5c5c;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: 20.8px;
  letter-spacing: 0.8px;
}
</style>
