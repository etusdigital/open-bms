<template>
  <div class="view-message-card">
    <LineComponent :type="'horizontal'" v-if="index > 0" />
    <div class="d-flex justify-center">
      <div class="div-icon">
        <span class="material-symbols-rounded font-24 icon-send"> send </span>
      </div>
      <div class="card-info">
        <template v-if="!editable">
          <div class="actions-card actions-card-icons text-end">
            <button
              v-tooltip.top="$t('button.viewMessage')"
              @click="openMessagePreview(index)"
              class="button-align icons-hover mr-2"
              type="button"
            >
              <span class="material-symbols-rounded font-24 icon-card-size">visibility</span>
            </button>
            <button
              v-tooltip.top="$t('title.editMessage')"
              @click="editMessage"
              class="button-align icons-hover"
              type="button"
            >
              <span class="material-symbols-rounded font-24 icon-card-size">edit</span>
            </button>
          </div>
          <div class="internal-div">
            <h6 class="title-message" @click="editable = true">
              {{ $t('datatable.message') }} {{ alphabetCode(index + 1) }}: {{ selectedOptionData.title }}
            </h6>
            <p class="content-text-message">{{ $t('create.subject') }}: {{ selectedOptionData.subject }}</p>
            <p class="content-subtext-message">{{ $t('datatable.sender') }}: {{ selectedOptionData.fromName }}</p>
            <div class="d-flex justify-space-between mt-4" v-if="message.statistics">
              <div class="element-statistics">
                <label>{{ $t('datatable.delivered') }}</label>
                <p>{{ message.statistics.total }}</p>
              </div>
              <div class="element-statistics">
                <label>{{ $t('datatable.open') }}</label>
                <p>{{ calculatePercentage(message.statistics.open, message.statistics.total) }}%</p>
              </div>
              <div class="element-statistics">
                <label>{{ $t('datatable.click') }}</label>
                <p>{{ calculatePercentage(message.statistics.click, message.statistics.total) }}%</p>
              </div>
              <div class="element-statistics">
                <label>CTR/OR</label>
                <p>{{ calculatePercentage(message.statistics.click, message.statistics.open) }}%</p>
              </div>
            </div>
            <v-dialog v-model="showMessagePreview">
              <MessagePreview
                :messageId="messages"
                :type="campaignType"
                :messageIndex="index"
                @closeMessagePreview="closeMessagePreview"
              />
            </v-dialog>
          </div>
        </template>

        <template v-else>
          <div class="internal-div">
            <div class="top-div">
              <label
                class="title-message-empty"
                style="
                   {
                    white-space: nowrap;
                  }
                "
                >{{ $t('datatable.chooseMessage') }}</label
              >
            </div>
            <v-autocomplete
              v-model="selectedOptionData"
              item-color="#EBE9E8"
              :elevation="0"
              class="c-autocomplete form-control mo-select"
              :placeholder="$t('input.searchMessage')"
              :no-data-text="
                isLoadingSearch
                  ? $t('input.searching')
                  : searchMessages
                    ? $t('create.notRegister')
                    : $t('datatable.noMessages')
              "
              :items="options"
              item-text="title"
              :return-object="true"
              :multiple="false"
              :outlined="false"
              :search-input.sync="searchMessages"
              :loading="isLoadingSearch"
              cache-items
              @change="changeValue"
              @click="handleAutocompleteClick(options)"
              filled
              solo
            />
          </div>
        </template>
      </div>
      <div class="align-center">
        <button v-tooltip.top="$t('title.removeItem')" @click="removeCardMessage" class="button-trash" type="button">
          <span class="material-symbols-rounded font-28 actions-card-icons delete-icon">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import MessagesService from '@/modules/messages/services/messages.service';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { CampaignMessageType } from '../enums/campaign.enum';
import { MessageStatus } from '@/modules/messages/enums/message.enum';
import MessagePreview from '@/components/common/MessagePreview.vue';

@Component({
  props: ['message', 'index', 'messageType', 'messages', 'campaignType'],
  components: { ButtonDefault, LineComponent, MessagePreview },
})
export default class MessageCardComponent extends Vue {
  private readonly messagesService = new MessagesService();
  @Prop() index!: number;
  @Prop() message!: any;
  @Prop() messageType!: string;
  @Prop() campaignType!: string;
  @Prop() messages!: any;

  editable = true;
  searchMessages = null;
  selectedOptionData: any = null;
  isLoadingSearch = false;
  options: any = [];
  noAvailableOptions: any = [];
  showMessagePreview = false;
  isInitialRequestMade = false;
  messageIndex = -1;

  beforeMount() {
    if (this.message.id) {
      this.selectedOptionData = this.message;
      this.editable = false;
    }
  }

  alphabetCode(path: number) {
    return String.fromCharCode(path + 64);
  }

  async handleAutocompleteClick(search: string) {
    if (search && !this.isInitialRequestMade) {
      try {
        this.isInitialRequestMade = true;
        this.isLoadingSearch = true;

        const data = await this.findMessages(search);
        this.options = data.results;
      } finally {
        this.isLoadingSearch = false;
      }
    }
  }

  @Watch('searchMessages')
  async onSearch(search: string) {
    if (search) {
      const data = await this.findMessages(search);
      this.options = data.results;
    }
  }

  async findMessages(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.messagesService.getMessages({
        title: search,
        page: 1,
        itemsPerPage: 40,
        type: this.messageType === CampaignMessageType.EMAIL ? 'email' : this.messageType,
        ...(this.messageType === CampaignMessageType.WHATSAPP && { status: MessageStatus.APPROVED }),
      });
      return response.data;
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  openMessagePreview(index?: number) {
    this.messageIndex = index || 0;
    this.showMessagePreview = true;
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  changeValue() {
    if (this.selectedOptionData) {
      this.$emit('changeMessageStep', this.index, this.selectedOptionData);
      this.editable = false;
    }
  }

  removeCardMessage() {
    const hasMessage = this.$props.messages && this.$props.messages[this.index];

    if (hasMessage) {
      this.$emit('removeCardMessage', this.index);
    }

    for (let i = this.index - 1; i >= 0; i--) {
      if (this.$props.messages && !this.$props.messages[i]) {
        this.editable = true;
        break;
      }
    }

    if (!hasMessage) {
      this.editable = true;
    }
    this.$emit('removeCardMessage', this.index);
  }

  calculatePercentage(dividend: number, divider: number) {
    return ((dividend / (divider || 1)) * 100).toFixed(1);
  }

  @Watch('message')
  updateValue() {
    this.selectedOptionData = this.$props.message;
    if (this.selectedOptionData && !this.selectedOptionData.id) {
      this.editable = true;
    }
  }

  editMessage() {
    let route;
    route = this.$router.resolve({
      path: `/messages/${this.messageType}/${this.selectedOptionData.id}`,
    });
    window.open(route.href, '_blank');
  }

  get messageId() {
    if (this.message) {
      return this.message.id;
    } else if (this.messages) {
      return this.messages.find((message: any) => message.id === this.selectedOptionData.id)?.providerMessageId;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.div-icon {
  position: absolute;
  margin-top: 20px;
  margin-left: -535px;
  height: 27px;
  width: 27px;
  border-radius: 14px;
  background-color: $ds-blue;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-send {
  margin-left: 4px;
}
.align-center {
  display: flex;
  align-items: center;
  margin-left: 8px;
}
.preview-windows {
  box-shadow:
    0px 1px 2px rgb(0 0 0 / 6%),
    0px 1px 3px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: row;
  height: fit-content;
}
.preview-android {
  border-radius: 10px;
}
.preview-message-bms {
  width: 556px !important;
  height: auto !important;
  padding: 20px !important;
  border-radius: 16px !important;
  gap: 16px !important;
  box-shadow: 0px 4px 6px 0px #0000001a !important;
  box-shadow: 0px 2px 4px 0px #0000000f !important;
}
.chrome-icon {
  height: 15px;
  width: 18px;
}
.message-android {
  color: #6b6b6b !important;
  font-size: 10px;
  font-weight: 200;
}
.icon-preview-windows {
  max-width: 150px;
  height: auto;
}
::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
.icon-preview-android {
  height: 75px;
  width: 80px;
}
.text-color {
  padding: 2px;
  margin: 0px !important;
  font-size: 12px;
  width: 250px;
  font-weight: 600;
}
.text-color-content {
  margin: 0px !important;
  padding: 2px;
  font-size: 12px;
  height: 30px;
  overflow: hidden;
}
.link-color {
  color: #c0c0c0 !important;
  height: 20px !important;
}

.chrome-title {
  height: 20px !important;
  align-self: flex-end;
}
.align-title {
  text-align: center;
  font-weight: 600;
}

.button-align {
  align-items: center;
}
.title-message {
  position: absolute;
  margin-top: -22px;
  margin-left: 8px;
  font-weight: 600;
  font-size: 14px;
  line-height: 18.2px;
  color: #0057f4;
  z-index: 1 !important;
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
  gap: 50px;
}
.gap-between {
  gap: 5px;
}
.align-title-android {
  align-items: self-start;
}
.modal-preview {
  border-radius: 16px;
  width: 556px;
  height: auto;
  padding: 20px;
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

.element-statistics {
  padding: 3px 1rem;
  border-radius: 12px;
  border: 0.5px solid #d9d9d9;
  background-color: linear-gradient(0deg, #d9d9d9, #d9d9d9), linear-gradient(0deg, #ffffff, #ffffff);

  width: 100px;
  label {
    font-size: 10px;
    color: #a6a6a6;
  }
  p {
    font-size: 16px;
    font-weight: bold;
    color: #a6a6a6;
  }
}

.actions-card {
  position: relative;
  margin-top: 8px;
  display: inline;
  margin-right: -25px;
}

.actions-card-icons {
  font-size: 20px;
  color: #a6a6a6;
}
.icons-hover:hover {
  color: #858585;
}
.delete-icon:hover {
  color: red;
}
.internal-div {
  width: 100%;
}
.top-div {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
  margin-top: 12px;
  margin-bottom: 7px;
}

.top-div label {
  margin-right: 260px;
}
.message-content-android {
  max-width: 300px;
  max-height: 400px;
}

.preview-wpp .wpp-column ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}
.preview-wpp .wpp-column .message-form ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}

.wpp-column {
  width: 100%;
  background-color: $ds-gray-100;
  border-radius: 16px;
}
.preview-wpp {
  width: 100%;
  display: flex;
  flex-direction: row;
  border: $ds-gray-100 3px solid;
  border-radius: 16px;
  margin-top: 15px;
}

.wpp-header {
  width: 100%;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.wpp-wrapper {
  background-color: $ds-gray-100;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  padding-bottom: 10px;
}
.text-color-content-wpp {
  margin: 0px !important;
  font-size: 16px;
  overflow: hidden;
  color: #282828;
  max-width: 100%;
  line-height: 1.25;
}
.wpp-text {
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  border-radius: 0px 8px 8px 8px;
  max-width: 60%;
  margin: 20px 0 0 12px;
  padding: 8px 0 0 12px;
}
.time {
  color: #8c8c8c;
  font-size: 11px;
  align-self: flex-end;
  margin-right: 4px;
}
.wpp-link {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 60%;
  margin: 2px 0 130px 12px;
  padding: 7px 0;
}
.text-link {
  color: #35b7f1;
  font-size: 14px;
  padding: 1px 0;
  margin-bottom: 0 !important;
  max-width: 60%;
}
</style>
