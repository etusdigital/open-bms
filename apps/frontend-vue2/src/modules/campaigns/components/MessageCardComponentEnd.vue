<template>
  <div class="view-message-card-end">
    <div class="d-flex justify-center">
      <div
        v-if="winner && campaign.type !== campaignsType.SIMPLE && campaign.type !== campaignsType.RECURRING"
        class="div-icon-winner margin-icon-winner"
      >
        <span class="material-symbols-rounded font-24">emoji_events</span>
      </div>
      <div
        v-if="!winner || campaign.type === campaignsType.SIMPLE || campaign.type === campaignsType.RECURRING"
        class="div-icon margin-icon"
      >
        <span class="material-symbols-rounded font-24 icon-send"> send </span>
      </div>
      <v-card class="mx-1 mt-0 messages-card">
        <div class="actions-card actions-card-icons text-end">
          <div class="progress-wrapper"></div>
          <div v-if="percentSent > 0 && campaign.type === campaignsType.TESTAB" class="mt-5 percent-class"></div>
          <div v-if="sent" class="mt-5 sent-class">
            <h6 class="d-flex align-center">
              <span class="material-symbols-rounded mr-2 font-icon-size"> check_circle </span>{{ $t('create.sended') }}
            </h6>
          </div>
          <div v-if="sending" class="mt-5 sending-class">
            <h6 class="d-flex align-center">
              <v-progress-circular :value="percentSent" :size="20"> </v-progress-circular>
              {{ $t('create.sending') }}
            </h6>
          </div>
          <button
            v-if="showViewMessage"
            v-tooltip.top="$t('button.viewMessage')"
            @click="openMessagePreview(index)"
            class="button-align icons-hover mr-2"
            type="button"
          >
            <span class="material-symbols-rounded font-24">visibility</span>
          </button>
          <div v-if="sending" class="mt-5 sending-class">
            <h6 class="d-flex align-center">
              <v-progress-circular :value="percentSent" :size="20"> </v-progress-circular>
              {{ $t('create.sending') }}
            </h6>
          </div>
          <button
            v-if="showViewMessage"
            v-tooltip.top="$t('button.viewMessage')"
            @click="openMessagePreview(index)"
            class="button-align icons-hover mr-2"
            type="button"
          >
            <span class="material-symbols-rounded font-24">visibility</span>
          </button>
        </div>
        <template>
          <div class="internal-div">
            <span class="title-message d-block" @click="editable = true">
              {{ $t('datatable.message') }} {{ alphabetCode(index + 1) }}: {{ selectedOptionData.title }}
            </span>
            <div class="message-content mt-3 mb-5 font-12">
              <span class="text-600 ds-gray-color" v-if="selectedOptionData.subject"
                >{{ $t('datatable.subject') }}: {{ selectedOptionData.subject }}</span
              >
              <div
                v-if="messageLinks.length || selectedOptionData.url"
                :class="[isMultipleLinks ? 'div-column' : 'div-row gap-5 w-100']"
              >
                <span class="ds-gray-color text-600">Link(s):</span>
                <a
                  v-if="['web-push', 'sms', 'whatsapp'].includes(message.type)"
                  class="ds-blue-color no-underline"
                  :href="selectedOptionData.url"
                  target="_blank"
                  >{{ selectedOptionData.url }}</a
                >
                <div
                  class="div-column"
                  :class="[!isMultipleLinks || messageLinks.length === 1 ? 'single-link' : 'w-100']"
                >
                  <a
                    v-for="(links, index) in visibleLinks"
                    :key="'ctaLink' + index"
                    :href="`${links}`"
                    target="_blank"
                    class="ds-blue-color links-decoration"
                  >
                    {{ links }}
                  </a>
                </div>
              </div>
              <button
                class="open-links text-600 font-10 mt-1"
                v-on:click="isMultipleLinks = !isMultipleLinks"
                v-if="messageLinks.length > 1"
              >
                {{ isMultipleLinks ? $t('input.showLess') : $t('input.showMore') }}
              </button>
            </div>
            <div class="d-flex mt-4 cards-statistics" v-if="shouldShowStatistics()">
              <div class="element-statistics color-purple" v-if="cardType === 'default'">
                <label>
                  <span class="material-symbols-rounded font-20 icon-statistics">science</span
                  >{{ $t('datatable.sample') }}
                </label>
                <p>{{ percentSent }}%</p>
              </div>
              <div
                class="element-statistics"
                :class="
                  type === 'open' && cardWinner
                    ? 'card-winner'
                    : type === 'open' && $props.campaign.status === 6
                    ? ''
                    : type === 'open' && !winner && ($props.campaign.status === 5 || $props.campaign.status === 6)
                    ? 'card-loss'
                    : type === 'open' && !winner && $props.campaign.status !== 5 && $props.campaign.status !== 6
                    ? 'card-loss'
                    : ''
                "
              >
                <label>
                  <span class="material-symbols-rounded font-20 icon-statistics">drafts</span>
                  {{ $t('datatable.open') }}
                </label>
                <h4 v-if="isEmptyObject(message.statistics)" class="loading-dot-flashing d-block"></h4>
                <p v-else>
                  {{
                    calculatePercentage(
                      message.statistics.open,
                      message.statistics && (message.statistics.delivered || message.statistics.total)
                    )
                  }}%
                  <span class="total-count-statistics">{{ message.statistics.open | formatNumber }}</span>
                </p>
              </div>
              <div
                class="element-statistics"
                :class="
                  type === 'click' && winner
                    ? 'card-winner'
                    : type === 'click' && $props.campaign.status === 6
                    ? ''
                    : type === 'click' && !winner
                    ? 'card-loss'
                    : type === 'click' && !winner && $props.campaign.status !== 5 && $props.campaign.status !== 6
                    ? 'card-loss'
                    : ''
                "
              >
                <label>
                  <span class="material-symbols-rounded font-20 icon-statistics">arrow_selector_tool</span>
                  {{ $t('datatable.click') }}
                </label>
                <h4 v-if="isEmptyObject(message.statistics)" class="loading-dot-flashing d-block"></h4>
                <p v-else>
                  {{
                    calculatePercentage(
                      message.statistics.click,
                      message.statistics && (message.statistics.delivered || message.statistics.total)
                    )
                  }}%
                  <span class="total-count-statistics">{{ message.statistics.click | formatNumber }}</span>
                </p>
              </div>
              <div class="element-statistics">
                <label><span class="material-symbols-rounded font-20 icon-statistics">pan_tool_alt</span>CTR/OR</label>
                <h4 v-if="isEmptyObject(message.statistics)" class="loading-dot-flashing d-block"></h4>
                <p v-else>{{ calculatePercentage(message.statistics.click, message.statistics.open) }}%</p>
              </div>
            </div>
            <div v-if="isEmptyObject(message.statistics)" class="total-delivered-class mt-5">
              <h4 class="loading-dot-flashing d-block"></h4>
            </div>
            <div v-else>
              <div v-if="shouldShowStatistics()" class="total-delivered-class mt-5">
                <span class="material-symbols-rounded mr-2 font-icon-size"> mail </span>
                {{
                  message.statistics && message.statistics.delivered > 1
                    ? $t('datatable.totalDeliveries')
                    : $t('datatable.totalDelivered')
                }}:
                {{ (message.statistics ? message.statistics.delivered : 0) | formatNumber }}
              </div>
            </div>
            <div class="d-flex justify-end mt-5">
              <router-link
                :to="`/messages/${messageType}/statistics?messages=${message.id}`"
                class="button-viewStatistics"
                target="_blank"
              >
                {{ $t('button.moreStatistics') }}
              </router-link>
            </div>
          </div>
          <v-dialog v-model="showMessagePreview">
            <MessagePreview
              :messageId="messages"
              :type="campaign.type"
              :messageIndex="messageIndex"
              :isStatistics="true"
              :filterId="campaign.id"
              filterType="campaign"
              @closeMessagePreview="closeMessagePreview"
            />
          </v-dialog>
        </template>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts">
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { CampaignsDto } from '../dtos/campaigns.dto';
import { CampaignsType } from '../enums/campaign.enum';
import MessagePreview from '@/components/common/MessagePreview.vue';

@Component({
  props: [
    'message',
    'index',
    'indexEnd',
    'type',
    'sent',
    'percentSent',
    'winner',
    'messageType',
    'campaign',
    'cardType',
    'showViewMessage',
    'sending',
    'messages',
  ],
  components: { ButtonDefault, MessagePreview },
})
export default class MessageCardComponentEnd extends Vue {
  @Prop() index!: number;
  @Prop() messageType!: string;
  @Prop() message!: any;
  @Prop() winner!: boolean;
  @Prop() type!: string;
  @Prop() cardType!: string;
  @Prop() sent!: number;
  @Prop() percentSent!: number;
  @Prop() campaign!: CampaignsDto;
  @Prop() showViewMessage!: boolean;
  @Prop() sending!: number;
  @Prop() messages!: any;

  public selectedOptionData: MessageDto = {};
  public campaignsType = CampaignsType;

  editable = false;

  cardWinner: any = {};
  showMessagePreview = false;

  extractedLinks: any = [];
  maxDisplayedLinks = 1;
  showMore = false;
  showMoreText = this.$t('input.showMore');
  progress = 30;
  messageIndex = -1;
  isMultipleLinks = false;
  messageLinks: string[] = [];

  beforeMount() {
    if (this.message.id) {
      this.selectedOptionData = this.message;
    }
    this.messageLinks = this.extractLinks(this.selectedOptionData.content as string);
    this.cardWinner = (this.selectedOptionData as any).winner;
  }

  get visibleLinks() {
    return this.isMultipleLinks ? this.messageLinks : this.messageLinks.slice(0, 1);
  }

  shouldShowStatistics() {
    return (
      (this.message.statistics && this.campaign.type === this.campaignsType.TESTAB) ||
      this.campaign.type === this.campaignsType.SPLIT
    );
  }

  toggleLinksVisibility() {
    if (this.maxDisplayedLinks === this.extractedLinks.length) {
      this.maxDisplayedLinks = 1;
      this.showMore = true;
      this.showMoreText = this.$t('input.showMore');
    } else {
      this.showMore = false;
      this.maxDisplayedLinks = this.extractedLinks.length;
      this.showMoreText = this.$t('input.showLess');
    }
  }

  extractLinks(html: string): string[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = new Set<string>();

    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && !href.includes('[unsubscribe_link]')) {
        links.add(href);
      }
    });
    return Array.from(links);
  }

  calculatePercentage(dividend: number, divider: number) {
    const validDividend = isNaN(dividend) ? 0 : dividend;
    const validDivider = isNaN(divider) || divider === 0 ? 1 : divider;
    const result = (validDividend / validDivider) * 100;
    if (isNaN(result)) {
      return '0.0';
    }

    return result.toFixed(1);
  }

  alphabetCode(path: number) {
    return String.fromCharCode(path + 64);
  }

  openMessagePreview(index?: number) {
    this.messageIndex = index || 0;
    this.showMessagePreview = true;
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  progressColor() {
    return this.progress === 0 ? '#D0C9F8' : '#7B61FF';
  }

  isEmptyObject<T extends object>(obj: T): boolean {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
  }

  @Watch('message')
  updateValue() {
    this.selectedOptionData = this.$props.message;
    this.messageLinks = this.extractLinks(this.selectedOptionData.content as string);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.progress-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
}
.actions-card {
  position: absolute;
  right: 10px;
  top: 10px;
  color: #a6a6a6;
}
.messages-card {
  width: 49%;
}
.total-delivered-class {
  bottom: 22px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  letter-spacing: 0em;
  text-align: left;
  color: $ds-gray;
  display: flex;
  position: absolute;
  justify-content: center;
  align-items: center;
}
.view-message-card-end {
  margin-right: 20px;
  min-width: 500px;
  max-width: 500px;
}
.font-icon-size {
  font-size: 20px !important;
}

.icon-send {
  margin-left: 3px;
}
.v-card {
  width: 100%;
  padding: 40px 20px 20px 20px;
  margin: 1em 0;
  border-radius: 16px;
}
.cards-statistics {
  white-space: nowrap;
  overflow-x: auto;
  max-width: 100%;
  &::-webkit-scrollbar {
    width: 100%;
    height: 4px;
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background-color: #888;
  }
}

/* Estilização para Firefox */
.cards-statistics::-moz-scrollbar {
  padding: 4px;
  width: 100%;
  height: 8px;
}
.div-icon,
.margin-icon-winner {
  position: absolute;
  margin-top: 18px;
  height: 27px;
  width: 27px;
  margin-left: -493px !important;
  border-radius: 14px;
  background-color: #ffc500;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.div-icon,
.margin-icon {
  position: absolute;
  margin-top: 18px;
  height: 27px;
  width: 27px;
  margin-left: -493px !important;
  border-radius: 14px;
  background-color: $ds-blue;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.margin-icon,
.margin-icon-winner {
  z-index: 1 !important;
}
.div-icon {
  z-index: 1 !important;
}

.button-align {
  top: 12px;
  right: 1px;
  position: absolute;
  align-items: center;
}
.title-message {
  margin-top: -15px;
  margin-left: 8px;
  font-weight: 600;
  font-size: 14px;
  line-height: 18.2px;
  color: #0057f4;
  z-index: 9;
}
.title-message-empty {
  font-size: 14px;
  font-weight: 600;
  line-height: 18.2px;
  margin-left: 8px;
  color: #0057f4;
}
.content-text-message {
  margin-top: 10px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 15.6px;
  color: #5c5c5c;
}

.content-subtext-message {
  margin-top: -12px;
  margin-left: 8px;
  font-size: 10px;
  font-weight: 400;
  line-height: 13px;
  color: #5c5c5c;
}
.message-form {
  display: flex;
  flex-direction: row;
}
.message-space-between {
  display: flex;
  flex-direction: row;
  gap: 100px;
}
.gap-between {
  gap: 5px;
}
.align-title-android {
  align-items: self-start;
}
.modal-preview {
  border-radius: 8px;
}
::v-deep .v-text-field__details {
  display: none;
}
.card-info {
  display: flex;
  flex-direction: column;
  background-color: white;
  padding: 10px 40px 20px 20px;
  border-radius: 15px;
  width: 500px;
  box-shadow: 0px 1px 3px 0px #0000001a;
}
.button-click {
  z-index: 10 !important;
}
.icon-statistics {
  position: relative;
  margin-left: -15px;
  margin-right: 4px;
  top: 4px;
}

.button-viewStatistics {
  min-width: 136px;
  height: 26px;
  left: 305px;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  gap: 10px;
  font-size: 10px;
  font-weight: 700;
  line-height: 10px;
  letter-spacing: 0.07em;
  text-align: center;
  color: #ffffff;
  background: $ds-blue !important;
  opacity: 1 !important;
  text-transform: uppercase;

  &:hover {
    background: $ds-blue-dark !important;
    text-decoration: none;
  }
}
.element-statistics {
  padding: 6px 6px 12px 12px;
  border-radius: 12px;
  border: 0.5px solid #d9d9d9;
  background-color: linear-gradient(0deg, #d9d9d9, #d9d9d9), linear-gradient(0deg, #ffffff, #ffffff);
  min-width: 80px;
  max-height: 62px;
  align-items: center;
  margin-right: 8px;
  margin-bottom: 4px;
  & label {
    font-size: 8px;
    font-weight: 400;
    line-height: 10px;
    letter-spacing: 0em;
    text-align: left;
    margin-left: 15px;

    color: #5c5c5c;
  }
  & p {
    font-size: 16px;
    font-weight: 600;
    line-height: 21px;
    letter-spacing: 0em;
    text-align: left;

    color: #5c5c5c;
  }
  & .total-count-statistics {
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    letter-spacing: 0em;
    text-align: left;
    text-overflow: ellipsis;
  }
}
.color-purple {
  label,
  p {
    color: $ds-purple;
  }
  border: 1px dashed $ds-purple;
}

.card-winner {
  label,
  p {
    color: #0fb75c;
  }
  border: 0.5px solid #0fb75c;
}

.card-loss {
  label,
  p {
    color: #f03232;
  }
  border: 0.5px solid #f03232;
}

.card-normal {
  label,
  p {
    color: #5c5c5c;
  }
  border: 0.5px solid #d9d9d9;
}

.sent-class h6 {
  position: absolute;
  top: 12px;
  right: 50px;
  font-size: 12px !important;
  color: #0fb75c;
  font-weight: 600;
}
.sending-class h6 {
  position: absolute;
  top: 5px;
  right: 20px;
  font-size: 12px !important;
  color: #7b61ff;
  font-weight: 600;
}
.percent-class .material-symbols-rounded {
  color: $ds-blue;
}
.div-icon-winner {
  margin-left: -36px;
  height: 30px;
  width: 30px;
  border-radius: 15px;
  background-color: #ffc500;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
}
.icon-winner {
  font-family: 15px;
  color: white;
  height: 24px;
  width: 24px;
}
.v-progress-circular {
  color: #7b61ff;
  margin: 0.35em;
}

.no-undderline {
  text-decoration: none !important;
}

.links-decoration {
  text-decoration: none !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block !important;
  &:hover {
    text-decoration: underline !important;
  }
}

.open-links {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  text-transform: uppercase;
  display: flex;
  justify-content: flex-start;

  &:hover {
    color: $ds-blue-dark;
  }
}

.single-link {
  max-width: 90%;
}

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
</style>
