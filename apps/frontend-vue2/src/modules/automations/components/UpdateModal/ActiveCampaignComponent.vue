<template>
  <div class="active-campaign-component" v-if="render">
    <div class="group-input mt-3">
      <label class="mb-0">{{ $t('title.accountName') }}</label>
      <input
        type="text"
        class="form-control"
        v-model="activeInfo.accountName"
        :placeholder="`${$t('title.infoAccountName')}`"
        @input="updateData"
        @blur="getActiveCampaignsLists"
      />
    </div>
    <div class="group-input mt-3">
      <label class="mb-0">{{ $t('title.apiKey') }}</label>
      <input
        type="text"
        class="form-control"
        v-model="activeInfo.apiKey"
        :placeholder="`${$t('title.infoApiKey')}`"
        @input="updateData"
        @blur="getActiveCampaignsLists"
      />
    </div>
    <label class="mt-3 mb-0">{{ $t('title.action') }}</label>
    <select class="form-control mo-select" disabled>
      <option>{{ $t('title.createContact') }}</option>
    </select>
    <select class="form-control mo-select mt-1" v-model="activeInfo.list" @change="updateData">
      <option value="" disabled v-if="isLoadingLists">{{ $t('title.loadingLists') }}</option>
      <option value="" disabled v-else>{{ $t('title.selectList') }}</option>
      <option v-for="list in activeList" :value="list" :key="list.name">
        {{ list.name }}
      </option>
    </select>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import AutomationsService from '@/modules/automations/services/automations.service';

@Component({
  components: {},
  props: ['render', 'step'],
})
export default class ActiveCampaignComponent extends Vue {
  private readonly automationServices = new AutomationsService();
  @Prop() step!: any;
  @Prop() render!: boolean;
  activeList = [];
  activeInfo = { type: 'createContact', list: '', apiKey: '', accountName: '' };
  isLoadingLists = false;

  beforeMount() {
    this.showModal();
  }
  hideModal() {
    this.$emit('hideModal');
  }
  updateData() {
    this.$emit('updateInfo', this.activeInfo);
  }
  @Watch('render')
  async showModal() {
    if (this.render && this.step?.settings) {
      this.activeInfo = this.step?.settings;
      await this.getActiveCampaignsLists();
    }
  }

  async getActiveCampaignsLists() {
    if (this.activeInfo.accountName && this.activeInfo.apiKey) {
      this.isLoadingLists = true;
      const response = await this.automationServices.activeCampaignLists(this.activeInfo);
      this.activeList = response.data?.lists.map((list: any) => {
        return { id: list.id, name: list.name, stringId: list.stringid };
      });
      this.isLoadingLists = false;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
</style>
