<template>
  <div class="div-row gap-15 w-100 justify-content-start">
    <div class="div-column gap-15 two-fa-card">
      <div class="div-row w-100 align-items-center justify-content-between">
        <span class="font-14 ds-blue-color text-600 card-title mb-0">
          {{
            message && message.title
              ? $t('title.messageTitle', { title: message.title })
              : $t('datatable.chooseMessage')
          }}
        </span>
        <div class="div-row gap-10 ds-gray-color" v-if="message">
          <span class="font-20 material-symbols-rounded cursor-pointer" @click="editMessage(message.id)">edit</span>
          <span class="font-20 material-symbols-rounded cursor-pointer" @click="showMessage(message.id)">
            visibility
          </span>
        </div>
      </div>
      <div v-if="message" class="div-column gap-5 ds-gray-color">
        <span v-if="message.subject" class="font-12 text-600"
          >{{ $t('datatable.subject') }}: {{ message.subject }}</span
        >
        <span v-if="message.fromName" class="font-10">{{ $t('datatable.sender') }}: {{ message.fromName }}</span>
        <span v-if="message.url" class="font-10 text-600 div-row gap-5 align-items-baseline">
          Link:
          <p class="ds-blue-color font-10 text-400 link-clip mb-0">{{ message.url }}</p>
        </span>
      </div>
      <div v-else class="div-row w-100 mb-2">
        <v-autocomplete
          v-model="selectedMessage"
          class="form-control mo-select"
          item-text="title"
          return-object
          solo
          :label="`${$t('input.select')}`"
          :no-data-text="`${$t('datatable.noData')}`"
          :items="messages"
          @input="updateData"
        >
        </v-autocomplete>
      </div>
      <div
        v-if="messageStatistics && messageStatistics.length > 0"
        class="div-row w-100 align-items-center gap-15 statistics-container pb-2"
      >
        <div
          v-for="statistic in messageStatistics"
          :key="statistic.id"
          class="div-column gap-5 statistic-card ds-gray-color justify-content-start"
        >
          <span class="font-12 text-600">{{ statistic.title }}</span>
          <div class="div-row align-items-end gap-10">
            <span class="font-14 full-value-statistic">{{ formatNumber(statistic.total) }}</span>
            <span v-if="statistic.percentage !== 0" class="font-10 percentage-statistic">
              {{ statistic.percentage !== 0 ? `${statistic.percentage}%` : '' }}
            </span>
          </div>
        </div>
      </div>
      <div
        v-if="message && message.title"
        class="div-row align-items-center gap-10 percentage-input-container ds-gray-color"
      >
        <span class="font-12 text-600 percentage-label">{{ $t('input.sendPercentage') }}</span>
        <input
          type="number"
          v-model.number="localPercentage"
          class="form-control mo-input"
          @input="updateData"
          min="0"
          max="100"
        />
      </div>
    </div>
    <v-dialog v-model="messageModal">
      <MessagePreview :messageId="messageId" @closeMessagePreview="closeMessage" />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import MessagePreview from '@/components/common/MessagePreview.vue';

@Component({
  components: {
    MessagePreview,
  },
  props: ['messages', 'message', 'percentage', 'index', 'messageStatistics', 'messageType'],
})
export default class TwoFaCards extends Vue {
  @Prop() private messages!: MessageDto[];
  @Prop() private message!: MessageDto;
  @Prop({ default: 0 }) private percentage!: number;
  @Prop() private index!: number;
  @Prop() private messageStatistics!: any[];
  @Prop() private messageType!: string;

  selectedMessage: MessageDto = {} as MessageDto;
  messageId = 0;
  messageModal = false;
  localPercentage = 0;

  beforeMount() {
    this.initializeData();
  }

  initializeData() {
    if (this.message) {
      this.selectedMessage = this.message;
      this.messageId = this.message.id || 0;
    }
    if (this.percentage) {
      this.localPercentage = this.percentage;
    }
  }

  updateData() {
    this.$emit('updateInfo', {
      message: this.selectedMessage,
      percentage: Number(this.localPercentage) || 0,
      index: this.index,
    });
  }

  showMessage(id: any) {
    this.messageId = id;
    this.messageModal = true;
  }

  editMessage(id: any) {
    this.$router.push({
      name: 'messages-2fa-edit',
      params: { type: this.messageType, message_id: id },
    });
  }

  closeMessage() {
    this.messageModal = false;
  }

  formatNumber(value: number) {
    return Vue.filter('formatNumber')(value);
  }

  @Watch('message', { immediate: true })
  onMessageChange() {
    this.initializeData();
  }

  @Watch('percentage', { immediate: true })
  onPercentageChange() {
    this.localPercentage = this.percentage;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.two-fa-card {
  border-radius: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  background-color: $neutral-basic-white;
  padding: 20px;
  width: 600px;
}
.card-title {
  place-self: flex-start;
}

.percentage-label {
  white-space: nowrap;
}

.link-clip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statistic-card {
  border-radius: 8px;
  padding: 10px;
  border: 1px solid $ds-gray-200;
  min-width: 140px;
  max-width: 140px;
}

.statistics-container {
  overflow-x: auto;
}

.full-value-statistic {
  margin-bottom: -1px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.percentage-statistic {
  max-width: 50px;
}

.percentage-input-container {
  place-self: flex-end;
  width: fit-content;
}

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
</style>
