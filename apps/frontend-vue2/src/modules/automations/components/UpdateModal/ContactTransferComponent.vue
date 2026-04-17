<template>
  <div class="div-column gap-15">
    <div class="div-column gap-5">
      <span class="ds-gray-color text-600 font-12">{{ $t('datatable.account') }}</span>
      <v-menu ref="menu" v-model="accountMenu" bottom :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <div
            class="account-menu inputs-height div-row align-items-center cursor-pointer justify-space-between px-2 inputs-radius"
            v-on="on"
          >
            <input
              class="ds-gray-color font-10"
              type="button"
              :value="accountName"
              :class="{ 'text-600': selectedAccount.name }"
            />
            <span class="material-symbols-rounded ds-gray-color" medium>arrow_drop_down</span>
          </div>
        </template>
        <v-card class="options-card inputs-radius">
          <div class="div-row align-items-center search-bar-select inputs-height px-2">
            <input
              id="header-menu__campaigns-search"
              class="search-input"
              type="text"
              :placeholder="$t('input.search')"
              @input="findItems($event.target.value, 'account')"
            />
            <span class="material-symbols-rounded ds-blue-color"> arrow_drop_up </span>
          </div>
          <div class="div-column max-list-height">
            <div
              class="d-flex px-2 py-3 align-items-center inputs-height list-border cursor-pointer"
              :key="`account-modal-filter-${i}`"
              v-for="(account, i) in filteredAccounts"
              @click="selectItem(account, 'account')"
            >
              <span class="ds-gray-color font-12">{{ account.name }}</span>
            </div>
          </div>
        </v-card>
      </v-menu>
    </div>
    <div class="div-column gap-5">
      <span class="ds-gray-color text-600 font-12">{{ $t('title.tag') }}</span>
      <v-menu
        ref="menu"
        v-model="tagMenu"
        bottom
        class="tag-menu"
        :close-on-content-click="false"
        :disabled="!selectedAccount.id"
      >
        <template v-slot:activator="{ on }">
          <div
            class="account-menu inputs-height inputs-radius div-row align-items-center cursor-pointer justify-space-between px-2"
            v-on="on"
            :class="{ disabled: !selectedAccount.id }"
          >
            <div class="div-row align-items-center gap-5">
              <input
                class="ds-gray-color font-10"
                type="button"
                :value="tagName"
                :class="{ 'text-600': selectedTag.name }"
              />
            </div>
            <span class="material-symbols-rounded ds-gray-color" medium>arrow_drop_down</span>
          </div>
        </template>
        <v-card class="options-card inputs-radius">
          <div class="div-row align-items-center search-bar-select inputs-height px-2">
            <input
              id="header-menu__campaigns-search"
              class="search-input"
              type="text"
              :placeholder="`${$t('input.search')}`"
              @input="findItems($event.target.value, 'tag')"
            />
            <span class="material-symbols-rounded ds-blue-color"> arrow_drop_up </span>
          </div>
          <div class="div-column max-list-height">
            <div
              class="d-flex px-2 py-3 align-items-center inputs-height list-border align-content-center cursor-pointer"
              :key="`tag-modal-filter-${i}`"
              v-for="(tag, i) in filteredTags"
              @click="selectItem(tag, 'tag')"
            >
              <span class="ds-gray-color font-12">{{ tag.name }}</span>
            </div>
          </div>
        </v-card>
      </v-menu>
    </div>
  </div>
</template>

<script lang="ts">
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import AccountsService from '@/modules/accounts/services/account.service';
import TagsService from '@/modules/tags/services/tag.service';

@Component({
  props: ['render', 'step'],
})
export default class ContactTransferComponent extends Vue {
  private readonly accountService = new AccountsService();
  private readonly tagService = new TagsService();

  @Prop() step!: any;
  @Prop() render!: boolean;

  accountMenu = false;
  tagMenu = false;
  accounts: AccountDto[] = [];
  selectedAccount: any = [];
  filteredAccounts: any = [];
  tags: TagDto[] = [];
  selectedTag: any = [];
  filteredTags: any = [];

  get accountName() {
    return this.selectedAccount.name || this.$t('input.select');
  }

  get tagName() {
    return this.selectedTag.name || this.$t('input.select');
  }

  async beforeMount() {
    await this.getAccounts();
  }

  async getAccounts() {
    const response = await this.accountService.getAccounts();
    this.accounts = response?.data;
    this.filteredAccounts = this.accounts;
  }

  async getTags() {
    const response = await this.tagService.getTags(
      {
        status: 'active',
        type: 'tag',
      },
      this.selectedAccount.id
    );
    this.tags = response?.data;
    this.filteredTags = this.tags;
  }

  findItems(value: string, itemType?: string) {
    const sourceItems = itemType === 'tag' ? this.tags : this.accounts;
    const searchValue = value?.toLowerCase();

    const filtered = !value
      ? sourceItems
      : (sourceItems as any[]).filter((item) => item.name.toLowerCase().includes(searchValue));

    if (itemType === 'tag') {
      this.filteredTags = filtered;
    } else {
      this.filteredAccounts = filtered;
    }
  }

  async selectItem(value: any, type: string) {
    if (type === 'account') {
      const apiKey = value.accountConfigs.find((config: any) => config.name === 'api_key')?.value;
      this.selectedAccount = { ...value, apiKey };
      this.accountMenu = false;
      this.selectedTag = [];
      await this.getTags();
    } else {
      this.selectedTag = value;
      this.tagMenu = false;
    }
    this.updateData();
  }

  updateData() {
    this.$emit('updateInfo', {
      accountId: this.selectedAccount.id,
      accountName: this.selectedAccount.name,
      tagId: this.selectedTag.id,
      tagName: this.selectedTag.name,
      apiKey: this.selectedAccount.apiKey,
    });
  }

  @Watch('selectedAccount')
  @Watch('selectedTag')
  onselectedAccountChange() {
    this.updateData();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.account-menu {
  width: 100%;
  border: 1px solid $ds-gray-300;
}

.options-card {
  border: 1px solid $ds-blue;
}

.search-bar-select {
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  overflow: hidden;
}

.search-input {
  min-height: 36px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: 100%;
}

.inputs-height {
  height: 36px !important;
}

.list-border {
  border-bottom: 1px solid $ds-gray-100;
  &:last-child {
    border-bottom: none;
  }
}

.inputs-radius {
  border-radius: 8px;
}

.max-list-height {
  max-height: 100px;
  overflow-y: auto;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
}

.tags-number {
  background: $ds-blue;
  border-radius: 50%;
  padding: 3px 6px;
}
.disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
}
</style>
