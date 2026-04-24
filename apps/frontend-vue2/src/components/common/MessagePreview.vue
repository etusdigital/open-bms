<template>
  <div class="messages-preview-card">
    <DataLoader :isLoading="isLoading" :type="'text,text,text,text,image'" class="data-loader-card" />
    <div :class="isLoading ? 'd-none' : ''" class="message-body div-column">
      <div class="div-row justify-space-between align-items-center mb-3">
        <span class="font-14 text-600 ds-blue-color">
          {{ currentTitle }}
        </span>
        <span
          class="material-symbols-rounded ds-gray-color cursor-pointer close-button font-24"
          @click.prevent="closeMessagePreview"
          >close
        </span>
      </div>
      <div v-if="type === 'testAB' && localMessage.length > 1" class="card-index shadows div-row gap-5 font-12 mb-4">
        <div
          v-for="(card, cardIndex) in localMessage"
          :key="cardIndex"
          class="div-row gap-5 messages-select align-items-center justify-content-center ds-light-gray-color"
          :class="{
            'ds-blue-color selected-message': !card.winner && cardIndex === currentMessageIndex,
            'winner-message': card.winner && cardIndex === currentMessageIndex,
          }"
        >
          <span class="material-symbols-rounded" v-if="card.winner">trophy</span>
          <span
            class="d-flex align-items-center justify-content-center cursor-pointer text-600"
            @click="changeIndex(cardIndex)"
          >
            {{ messagesIndex[cardIndex].title.replace(':', '') }}
          </span>
        </div>
      </div>
      <div class="div-column" v-for="(messages, index) in localMessage" :key="index">
        <div
          v-if="localMessage.length === 1 || index === currentMessageIndex"
          class="message-info shadows ds-gray-color mb-4"
        >
          <div v-if="messageType === 'email' || messageType === '2FA-email'" class="div-row gap-5 font-14">
            <span class="text-600">{{ $t('create.subject') }}:</span>
            <span>{{ messages.subject }}</span>
          </div>
          <div v-if="messageType === 'email' || messageType === '2FA-email'" class="div-row gap-5 font-12">
            <span class="text-600">{{ $t('create.preview') }}:</span>
            <span>{{ messages.previewText }}</span>
          </div>
          <div v-if="messageType === 'email' || messageType === '2FA-email'" class="div-row gap-5 font-12">
            <span class="text-600">{{ $t('datatable.from') }}:</span>
            <div class="div-row gap-5">
              <span>{{ messages.fromName }}</span>
              <span>&lt;{{ messages.fromMail }}&gt;</span>
            </div>
          </div>
          <div
            v-if="(messageType === 'email' || messageType === '2FA-email') && messageLinks.length"
            :class="[isMultipleLinks ? 'div-column' : 'div-row gap-5']"
          >
            <span class="ds-gray-color font-12 text-600">Link(s):</span>
            <div
              class="div-column font-12"
              :class="[!isMultipleLinks || messageLinks.length === 1 ? 'single-link' : 'w-100']"
            >
              <a
                v-for="(links, index) in visibleLinks"
                :key="'ctaLink' + index"
                :href="`${links}`"
                target="_blank"
                class="ds-blue-color links-decoration no-underline"
              >
                {{ links }}
              </a>
            </div>
          </div>
          <button
            class="open-links text-600 font-10 mt-1"
            v-on:click="isMultipleLinks = !isMultipleLinks"
            v-if="(messageType === 'email' || messageType === '2FA-email') && messageLinks.length > 1"
          >
            {{ isMultipleLinks ? $t('input.showLess') : $t('input.showMore') }}
          </button>
          <div
            v-if="['web-push', 'sms', 'whatsapp', 'mobile-push', '2FA-sms', '2FA-whatsapp'].includes(messageType)"
            class="div-row gap-5 font-12"
          >
            <span class="text-600"> Link:</span>
            <a class="ds-blue-color no-underline" :href="messages.url" target="_blank">{{ messages.url }}</a>
          </div>
        </div>
        <div
          v-if="
            (localMessage.length === 1 || index === currentMessageIndex) &&
            (messageType === 'email' || messageType === '2FA-email')
          "
          class="message-content shadows d-flex"
        >
          <div v-html="addClickStatsToLinks(messages.content)"></div>
        </div>
        <div v-if="(localMessage.length === 1 || index === currentMessageIndex) && messageType === 'web-push'">
          <div class="div-column gap-5">
            <span class="text-600 font-12 ds-gray-color">Web</span>
            <div class="div-row push-preview shadows gap-10">
              <img class="icon-preview" :src="messages.image === null ? briusLogo : messages.image" alt="" />
              <div class="div-column p-3">
                <span class="text-600 font-12 ds-gray-color pb-1">
                  {{ messages.subject }}
                </span>
                <span class="text-400 font-12 ds-gray-color">{{ messages.content }}</span>
                <span class="text-400 font-12 link-color pt-6">{{ accountDefaultDomain }}</span>
              </div>
            </div>
          </div>
          <div class="div-column gap-5 pt-2">
            <span class="text-600 font-12 ds-gray-color">Android</span>
            <div class="div-row push-preview push-preview-android gap-10">
              <div class="div-column gap-5">
                <span class="text-400 font-10 link-color">{{ accountDefaultDomain }}</span>
                <span class="text-600 font-12 ds-gray-color">{{ messages.subject }}</span>
                <span class="text-400 font-12 ds-gray-color">{{ messages.content }}</span>
              </div>
              <img class="icon-preview" :src="messages.image === null ? briusLogo : messages.image" alt="" />
            </div>
          </div>
        </div>
        <div
          v-if="
            (localMessage.length === 1 || index === currentMessageIndex) &&
            (messageType === 'sms' || messageType === '2FA-sms')
          "
          class="sms-preview shadows div-column"
        >
          <div class="message-start align-items-center">
            <span class="d-flex material-symbols-rounded icon-width pl-2">arrow_back_ios</span>
            <span class="d-flex font-18 text-600 account-name">{{ currentAccount.name }}</span>
          </div>
          <div class="div-column message-center pb-4">
            <span class="pt-5 pb-5 align-self-center d-flex time-color"> {{ $t('input.today') }}, {{ wppTime }} </span>
            <div class="sms-content div-column ml-2 font-14 shadows">
              <div class="d-flex">
                <span class="d-flex" v-if="messages.content === '' || messages.content === undefined">
                  {{ $t('create.messageContent') }}
                </span>
                <span class="d-flex" v-else>{{ messages.content }}</span>
              </div>
              <span v-if="messages.url" class="d-flex ds-blue-color text-decoration-underline url-style">
                {{ messages.url }}
              </span>
            </div>
          </div>
        </div>
        <div
          v-if="
            (localMessage.length === 1 || index === currentMessageIndex) &&
            (messageType === 'whatsapp' || messageType === '2FA-whatsapp')
          "
          class="wpp-preview shadows div-column"
        >
          <div class="div-row p-3 justify-space-between wpp-header">
            <div class="div-row gap-10 align-items-center">
              <span class="d-flex material-symbols-rounded icon-width">arrow_back_ios</span>
              <span class="profile-pic"></span>
              <div class="div-column">
                <span class="font-18 text-600">{{ currentAccount.name }}</span>
                <span class="font-12 ds-light-gray-color">online</span>
              </div>
            </div>
            <div class="div-row gap-15 align-items-center pr-3">
              <span class="material-symbols-rounded font-24 ds-light-gray-color">videocam</span>
              <span class="material-symbols-rounded font-24 ds-light-gray-color">call</span>
            </div>
          </div>
          <div class="wpp-content div-column">
            <div class="wpp-message shadow-wpp wpp-border">
              <div class="div-column gap-5">
                <template v-if="messages.content">
                  <div
                    v-if="
                      getMessageContent(messages.content).headerType === 'text' &&
                      getMessageContent(messages.content).headerContent
                    "
                    class="d-flex font-14 text-600 align-items-start"
                  >
                    {{ getMessageContent(messages.content).headerContent }}
                  </div>
                  <div
                    v-if="
                      getMessageContent(messages.content).headerType === 'image' &&
                      getMessageContent(messages.content).headerContent
                    "
                    class="wpp-image"
                  >
                    <img :src="getMessageContent(messages.content).headerContent" alt="header image" />
                  </div>
                  <div
                    v-if="
                      getMessageContent(messages.content).headerType === 'video' &&
                      getMessageContent(messages.content).headerContent
                    "
                    class="wpp-image"
                  >
                    <video :src="getMessageContent(messages.content).headerContent" controls preload="metadata"></video>
                  </div>
                </template>
                <span class="d-flex font-12" v-if="messages.content">
                  {{ getMessageContent(messages.content).body }}
                </span>
                <span class="d-flex font-12" v-else>
                  {{ $t('create.messageContent') }}
                </span>
                <span
                  v-if="messages.content && getMessageContent(messages.content).footer"
                  class="d-flex font-12 ds-gray-color"
                >
                  {{ getMessageContent(messages.content).footer }}
                </span>
              </div>
              <div class="div-row justify-content-end align-items-center ds-light-gray-color">
                <span class="d-flex font-21">{{ wppTime }} </span>
                <span class="material-symbols-rounded font-14">check</span>
              </div>
            </div>
            <div class="wpp-message link-border shadows justify-content-center d-flex">
              <span
                class="font-14 wpp-link-color"
                v-if="messages.callToActionText === '' || messages.callToActionText === null"
              >
                Link
              </span>
              <span class="font-14 wpp-link-color" v-else>{{ messages.callToActionText }}</span>
            </div>
          </div>
        </div>
        <div v-if="(localMessage.length === 1 || index === currentMessageIndex) && messageType === 'mobile-push'">
          <div class="div-column gap-5">
            <span class="text-600 font-12 ds-gray-color">Android</span>
            <div class="div-row align-items-center gap-10 push-preview shadows mobile-push-padding">
              <div class="div-column gap-5">
                <span class="text-600 font-12 ds-gray-color">
                  {{ messages.subject }}
                </span>
                <span class="text-400 font-12 ds-gray-color">{{ messages.content }}</span>
              </div>
              <div class="div-row align-items-start">
                <img class="mobile-icon-preview" :src="messages.image === null ? briusLogo : messages.image" alt="" />
                <span class="material-symbols-rounded font-24 ds-gray-color">keyboard_arrow_down</span>
              </div>
            </div>
          </div>
          <div class="div-column gap-5 pt-2">
            <span class="text-600 font-12 ds-gray-color">IOS</span>
            <div class="div-row align-items-center gap-10 push-preview shadows mobile-push-padding">
              <div class="div-column gap-5">
                <span class="text-600 font-12 ds-gray-color">{{ messages.subject }}</span>
                <span class="text-400 font-12 ds-gray-color">{{ messages.content }}</span>
              </div>
              <img
                class="mobile-icon-preview mr-6"
                :src="messages.image === null ? briusLogo : messages.image"
                alt=""
              />
            </div>
          </div>
        </div>
      </div>
      <div v-if="shouldShowStatsSwitch" class="div-row justify-content-end w-100">
        <v-switch v-model="showStats" centerAffix inset :label="`${$t('input.hideStats')}`"></v-switch>
      </div>
      <ButtonDefault
        :name="`${$t('title.editMessage')}`"
        @click="editMessage()"
        data-cy="button-view-fields"
        class="btn-edit buttons-specs mt-4"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import MessagesService from '@/modules/messages/services/messages.service';
import { getAccountConfig } from '@/store';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { ActionHandler, mapState } from 'vuex';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { calculateTextPlainLinkOffset } from '@/util/click-stats-offset';

@Component({
  components: { ButtonDefault, DataLoader },
  props: ['message', 'messageId', 'type', 'messageIndex', 'isStatistics', 'filterId', 'filterType'],
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class MessagePreview extends Vue {
  private readonly messagesService = new MessagesService();
  @Prop() message!: any;
  @Prop() messageId!: any;
  @Prop() type!: string;
  @Prop() messageIndex!: number;
  @Prop() isStatistics!: boolean;
  @Prop() filterId?: number;
  @Prop() filterType?: 'campaign' | 'automation';

  currentAccount!: AccountDto;
  localMessage: Array<MessageDto> = new Array<MessageDto>();
  accountDefaultDomain = '';
  currentMessageIndex = -1;
  messageType = '';
  briusLogo = require('@/assets/brius-logo-blue.svg');
  isLoading = false;
  messagesIndex = [
    { title: this.$t('input.messageA') as string },
    { title: this.$t('input.messageB') as string },
    { title: this.$t('input.messageC') as string },
    { title: this.$t('input.messageD') as string },
  ];
  isMultipleLinks = false;
  messageLinks: string[] = [];
  clickStats: any[] = [];
  showStats = false;

  beforeMount() {
    this.checkValues();
  }

  get currentTitle() {
    if (this.localMessage.length === 1) {
      return this.localMessage[0]?.title;
    }
    return this.localMessage[this.currentMessageIndex]?.title;
  }

  get wppTime() {
    return new Date().toLocaleTimeString(this.$store.state.userLanguage, { hour: '2-digit', minute: '2-digit' });
  }

  get visibleLinks() {
    return this.isMultipleLinks ? this.messageLinks : this.messageLinks.slice(0, 1);
  }

  get shouldShowStatsSwitch() {
    if (!this.currentAccount?.isInternal) {
      return false;
    }

    if (this.localMessage.length === 1) {
      return (this.localMessage[0]?.clickStats?.length ?? 0) > 0;
    }

    return (this.localMessage[this.currentMessageIndex]?.clickStats?.length ?? 0) > 0;
  }

  addClickStatsToLinks(content: string | undefined): string {
    if (!content) {
      return '';
    }
    if (!this.clickStats || this.showStats) {
      return content;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const anchors = Array.from(tempDiv.querySelectorAll('a'));

    const offset = calculateTextPlainLinkOffset(content);

    anchors.forEach((anchor, index) => {
      const href = anchor.getAttribute('href');
      if (!href || href.includes('[unsubscribe_link]')) {
        return;
      }
      const statsKey = (index + offset).toString();
      const stats = this.clickStats.find((stat) => stat.key === statsKey);

      if (stats) {
        const total = this.clickStats.reduce((sum, stat) => sum + parseInt(stat.total, 10), 0);
        const wrapper = document.createElement('span');
        wrapper.style.position = 'relative';

        anchor.parentNode?.replaceChild(wrapper, anchor);
        wrapper.appendChild(anchor);

        const statsHtml = `
          <span class="click-stats tooltip-style text-600 font-12 px-4 py-2"
                style="position: absolute; left: 50%; transform: translateX(-50%);
                bottom: -45px; z-index: 10; white-space: nowrap;">
            ${this.$t('input.clickStat', {
              clickNumber: stats.total,
              clickPercent: ((parseInt(stats.total, 10) / total) * 100).toFixed(1),
            })}
          </span>
        `;

        anchor.insertAdjacentHTML('beforeend', statsHtml);
      }
    });

    return tempDiv.innerHTML;
  }

  closeMessagePreview() {
    this.$emit('closeMessagePreview');
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

  async getMessages() {
    try {
      this.isLoading = true;
      let messagePromises = [];
      if (Array.isArray(this.messageId)) {
        const messageIds = this.messageId.map((msg: any) => {
          if (msg.id) {
            return msg.id;
          }
          if (msg.messageId) {
            return msg.messageId;
          }
          return msg;
        });

        if (this.isStatistics && this.filterId && this.filterType) {
          messagePromises = messageIds.map((id: number) =>
            this.messagesService.getMessageClickStatistics(id, this.filterId, this.filterType)
          );
        } else {
          messagePromises = messageIds.map((id: number) => this.messagesService.getMessageById(id));
        }
        const results = await Promise.all(messagePromises);
        this.localMessage = results.map((result: any, index: number) => ({
          ...result.data,
          winner: this.messageId[index].winner ? this.messageId[index].winner : false,
        }));
      } else {
        if (this.isStatistics && this.filterId && this.filterType) {
          messagePromises = [
            this.messagesService.getMessageClickStatistics(this.messageId, this.filterId, this.filterType),
          ];
        } else {
          messagePromises = [this.messagesService.getMessageById(this.messageId)];
        }
        const results = await Promise.all(messagePromises);
        this.localMessage = results.map((result: any) => result.data);
      }
    } finally {
      this.isLoading = false;
    }
  }

  editMessage() {
    let messageId;
    let route;

    if (typeof this.currentMessageIndex === 'number' && this.currentMessageIndex !== -1) {
      messageId = this.localMessage[this.currentMessageIndex]?.id;
    }
    if (
      this.currentMessageIndex === undefined ||
      this.currentMessageIndex === null ||
      this.currentMessageIndex === -1
    ) {
      messageId = this.messageId;
    }

    route = this.$router.resolve({
      path: `/messages/${this.messageType.startsWith('2FA-') ? '2FA/' : ''}${this.messageType.replace(
        '2FA-',
        ''
      )}/${messageId}`,
    });
    window.open(route.href, '_blank');
  }

  getMessageContent(content: string) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  @Watch('messageIndex')
  changeIndex(index: number) {
    this.currentMessageIndex = index;
    this.messageLinks = this.extractLinks(this.localMessage[this.currentMessageIndex]?.content as string);
    this.clickStats = this.localMessage[this.currentMessageIndex]?.clickStats || [];
  }

  @Watch('message')
  @Watch('messageId')
  async checkValues() {
    this.localMessage = [];

    if (this.messageId) {
      await this.getMessages();
    }
    if (!this.messageId) {
      this.localMessage = this.message;
    }
    this.currentMessageIndex = this.messageIndex;
    this.messageType = this.localMessage?.map((message: any) => message.type).shift();
    this.accountDefaultDomain = (getAccountConfig(this.currentAccount, 'default_domain') ?? '').replace(
      /^https?:\/\//,
      ''
    );
    this.messageLinks = this.extractLinks(
      this.localMessage.length === 1
        ? (this.localMessage[0]?.content as string)
        : (this.localMessage[this.currentMessageIndex]?.content as string)
    );
    if (this.localMessage?.length === 1) {
      this.clickStats = this.localMessage[0]?.clickStats || [];
    } else if (this.localMessage?.length > 1 && this.currentMessageIndex >= 0) {
      this.clickStats = this.localMessage[this.currentMessageIndex]?.clickStats || [];
    } else {
      this.clickStats = [];
    }
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.messages-preview-card {
  border-radius: 16px;
  background-color: $neutral-basic-white;
  display: flex;
  align-content: center;
  justify-content: center;
  padding: 20px;
  width: 600px;
  height: fit-content;
}

.close-button {
  display: flex;
  justify-content: center;
  padding: 3px;
  &:hover {
    border-radius: 50%;
    background-color: #f5f5f5;
  }
}

.message-body {
  width: -webkit-fill-available;
}

.card-index {
  height: 48px;
  padding: 10px;
  border-radius: 16px;
}

.messages-select {
  padding: 5px 10px 5px 10px;
  border-radius: 8px;
  &:hover {
    background-color: #f5f5f5;
  }
}

.selected-message {
  background-color: #f4f8ff;
  &:hover {
    background-color: #f4f8ff !important;
  }
}

.message-info {
  padding: 10px 20px 10px 20px;
  gap: 4px;
  border-radius: 16px;
  background-color: #f5f5f5;
}

.message-content {
  place-self: center;
  border-radius: 16px;
  border: 1px solid $ds-gray-300;
  overflow-y: auto;
  height: 400px;
  width: 100%;
}

.push-preview {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
}

.push-preview-android {
  justify-content: space-between;
  padding: 10px 15px 10px 15px;
}

.link-color {
  color: #a6a6a6;
}

.icon-preview {
  height: 102px;
  width: 20%;
}

.mobile-icon-preview {
  height: 55px;
  width: 55px;
}

.mobile-push-padding {
  justify-content: space-between;
  padding: 10px 5px 10px 15px;
}

.shadows {
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
}

.sms-preview {
  width: 100%;
  border-radius: 16px;
  height: fit-content;
  border: 2px solid $ds-gray-300;
}

.message-start {
  display: grid;
  grid-template-columns: 3% 97%;
  border-radius: 14px 14px 0px 0px !important;
  padding: 12px 6px 12px 6px;
}

.icon-width {
  width: fit-content;
  color: $ds-gray-300;
  font-size: 30px;
}

.account-name {
  place-content: center;
}

.message-center {
  background-color: $ds-gray-100;
  border-radius: 0px 0px 14px 14px !important;
}

.time-color {
  color: #8c8c8c;
}

.sms-content {
  background-color: $neutral-basic-white;
  border-radius: 8px 8px 8px 0px;
  padding: 10px;
  max-width: 60%;
  overflow-wrap: anywhere;
}

.url-style {
  max-width: 100%;
}

.profile-pic {
  width: 46.18px;
  height: 46.23px;
  border-radius: 50%;
  background-color: #c4c4c4;
}

.wpp-preview {
  width: 100%;
  border-radius: 16px;
  border: 2px solid $ds-gray-300;
}

.wpp-content {
  background-color: $ds-gray-100;
  border-radius: 0px 0px 14px 14px !important;
  gap: 2px;
  padding: 16px 8px 16px 8px;
}

.wpp-message {
  background-color: $neutral-basic-white;
  max-width: 300px;
  padding: 5px 10px 5px 10px;
}

.shadow-wpp {
  box-shadow: 0px 8px 12px 0px #0000000d;
}

.wpp-border {
  border-radius: 0px 8px 8px 8px;
  overflow-wrap: anywhere;
}

.link-border {
  border-radius: 8px;
  min-height: 34px;
}

.wpp-link-color {
  color: #35b7f1;
}

.btn-edit {
  color: $ds-blue !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-blue;
  padding: 14px !important;
}

.btn-edit:hover {
  background-color: #ffffff !important;
}
.buttons-specs {
  display: flex;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  box-shadow: none;
  font-weight: 700;
  font-size: 10px;
  max-height: 26px !important;
  padding: 15px !important;
  place-self: self-end;
  width: fit-content;
}

.data-loader-card {
  width: 100%;
}

.single-link {
  max-width: 90%;
}

.links-decoration {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block !important;
}

.no-underline {
  text-decoration: none !important;
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

.wpp-image {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
  }
  video {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
  }
}

.winner-message {
  color: white !important;
  background-color: #ffc500 !important;
  &:hover {
    color: #ffc500 !important;
    background-color: white !important;
  }
}

::v-deep .v-input__slot {
  flex-direction: row-reverse;
  gap: 10px;
  & label {
    margin-bottom: 0px !important;
    font-size: 14px;
  }
}
</style>

<style lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.click-stats {
  border-radius: 8px;
  background-color: $ds-blue;
  color: white;
  display: block;
  text-align: center;
  margin-top: 10px;
  width: max-content;
  position: relative;
}

.tooltip-style {
  &:before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 8px solid $ds-blue;
    z-index: 2;
  }
}
</style>
