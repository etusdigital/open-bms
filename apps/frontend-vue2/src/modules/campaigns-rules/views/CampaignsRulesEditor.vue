<template>
  <div class="view-campaign-template">
    <div class="edit-title campaign-title">
      <router-link to="/campaign-rules" class="clickable-breadcrumb">
        <span class="material-symbols-rounded font-16">chevron_left</span>
        <span class="title-crumb">{{ $t('sidebar.campaignRules') }}</span>
      </router-link>
      <div class="edit-title">
        <h2 class="c-title">{{ $t('button.newCampaignRule') }}</h2>
      </div>
    </div>
    <label class="name label-title font-16 mt-5">{{ $t('title.details') }}</label>
    <v-card class="background-card d-flex div-column gap-10 card-name-description w-100">
      <div class="w-100">
        <div class="div-row gap-10 align-items-center w-100">
          <InputDefault
            :name="`${$t('title.name')}`"
            data-cy="campaign-new-name"
            id="campaign-new-name"
            :modelValue="newRule.name"
            :placeholder="`${$t('input.campaignRuleNameType')}`"
            @updateInput="updateInput"
            :keyInput="'name'"
            class="mb-0"
          />
        </div>
      </div>
      <InputDefault
        data-cy="campaign-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="newRule.description"
        :placeholder="`${$t('input.campaignRuleDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
    </v-card>
    <label class="name label-title font-16 mt-3">{{ $t('sidebar.campaignConfigs') }}</label>
    <v-card class="background-card card-name-description w-100">
      <div>
        <div class="selected-chips mb-5">
          <v-chip
            v-for="(item, index) in chipTags"
            :key="`addRemovetag-${index}`"
            close
            @click:close="removeSelectedItem(item)"
          >
            {{ item.name }}
          </v-chip>
        </div>
      </div>
      <div class="d-flex w-100 gap-10">
        <div class="w-75 mt-5">
          <v-autocomplete
            v-model="selectedOptionData"
            item-color="#EBE9E8"
            :elevation="0"
            class="c-autocomplete autocomplete-list"
            :placeholder="selectedConfigs() > 0 ? '' : $t('input.search')"
            :items="optionsSelect"
            :item-text="'name'"
            :return-object="true"
            :multiple="true"
            :outlined="false"
            :search-input.sync="searchOptions"
            @click="searchData()"
            solo
            @focus="isFocused = true"
            @blur="isFocused = false"
          >
            <template v-slot:selection="data">
              <div
                v-if="data.index === 0"
                class="gap-5 align-items-center"
                :class="[searchOptions ? 'd-none' : 'div-row']"
              >
                <span class="font-12 text-600 ds-gray-color">
                  {{ $t('input.selected') }}
                </span>
                <span class="autocomplete-counter font-12 text-600 d-flex ds-white-color align-items-center">
                  {{ selectedConfigs() }}
                </span>
              </div>
            </template>
          </v-autocomplete>
        </div>
        <div class="div-column gap-10">
          <label class="font-12 label-title input-font mb-0">{{ $t('title.permittedDays') }}</label>
          <div class="div-row gap-10">
            <div v-for="day in daysOptions" :key="day.value">
              <v-tooltip top>
                <template v-slot:activator="{ on }">
                  <button
                    @click="selectDay(day.value)"
                    v-on="on"
                    class="font-12 text-400 days-buttons"
                    type="button"
                    :class="{ 'day-button-active': newRule.weekDays && newRule.weekDays.includes(day.value) }"
                  >
                    {{ day.title[0] }}
                  </button>
                </template>
                <span>{{ day.title }}</span>
              </v-tooltip>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <div class="footer-buttons">
      <ButtonDefault
        :name="$t('button.save')"
        type="button"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
        @click="saveRule"
      ></ButtonDefault>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import CampaignRuleService from '@/modules/campaigns-rules/services/campaign-rule.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { CampaignRuleDto } from '../dtos/campaign-rule.dto';
import ToastService from '@/services/toast.service';

@Component({
  components: { ButtonDefault, InputDefault },
})
export default class CampaignsRulesEditor extends Vue {
  private readonly campaignRuleService = new CampaignRuleService();
  private readonly toastService = new ToastService();
  @Prop([Number]) readonly id!: number;
  newRule: CampaignRuleDto = {} as CampaignRuleDto;
  chipTags: any = [];
  selectedOptionData: any = [];
  optionsSelect: any = [];
  searchOptions: any = null;
  isNew = true;

  daysOptions = [
    { title: this.$t('input.sunday') as string, value: 0 },
    { title: this.$t('input.monday') as string, value: 1 },
    { title: this.$t('input.tuesday') as string, value: 2 },
    { title: this.$t('input.wednesday') as string, value: 3 },
    { title: this.$t('input.thursday') as string, value: 4 },
    { title: this.$t('input.friday') as string, value: 5 },
    { title: this.$t('input.saturday') as string, value: 6 },
  ];

  async beforeMount() {
    if (this.id) {
      this.isNew = false;
      const result = (await this.campaignRuleService.getCampaignRuleById(this.id)).data;
      this.newRule = result;
      this.selectedOptionData = result.campaignsRulesConfigs.map((item: any) => {
        return { id: item.campaignConfig.id, name: item.campaignConfig.name };
      });
    }
    this.newRule.weekDays = this.newRule.weekDays ? this.newRule.weekDays : [];
  }

  selectDay(dayValue: number) {
    const index = this.newRule.weekDays.indexOf(dayValue);
    if (index !== -1) {
      this.newRule.weekDays.splice(index, 1);
    } else {
      this.newRule.weekDays.push(dayValue);
    }
    this.newRule.weekDays.sort();
  }

  updateInput(event: never, key: never) {
    this.newRule[key] = event;
  }

  async searchData(name?: string) {
    const configs = (
      await this.campaignRuleService.getCampaignsConfigs({
        page: 1,
        itemsPerPage: 10,
        order: 'ASC',
        sortBy: 'name',
        ...(name ? { name } : {}),
      })
    ).data;

    this.optionsSelect = configs.results.map((item: any) => {
      return { id: item.id, name: item.name };
    });
  }

  @Watch('searchOptions')
  async onSearch(search: string) {
    await this.searchData(search);
  }

  @Watch('selectedOptionData')
  fillChips() {
    this.chipTags = [];
    this.chipTags = this.chipTags.concat(this.selectedOptionData);
  }

  removeSelectedItem(item: any) {
    const index = this.chipTags.indexOf(item);
    if (index >= 0) {
      this.chipTags.splice(index, 1);
    }
    this.selectedOptionData = this.chipTags;
  }

  selectedConfigs() {
    if (this.chipTags && Array.isArray(this.chipTags)) {
      return this.chipTags.length;
    }
    return 0;
  }

  async saveRule() {
    const data = { ...this.newRule, configs: this.selectedOptionData };
    try {
      if (this.isNew) {
        await this.campaignRuleService.createCampaignRule(data);
      } else {
        await this.campaignRuleService.updateCampaignRule(data);
      }
      this.$router.push({ name: 'campaigns-rules' });
      this.toastService.show({
        type: 'success',
        text: this.isNew ? (this.$t('modal.ruleCreated') as string) : (this.$t('modal.ruleChanged') as string),
      });
    } catch (e) {
      console.error(e);
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.view-campaign-template {
  padding-top: 1em;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  h2 {
    display: flex;
    width: 100%;
    gap: 2em;
  }
}

.input-font {
  color: #5c5c5c !important;
}

.selected-chips ::v-deep .v-chip {
  margin-right: 8px;
  margin-bottom: 8px;
  background: $neutral-basic-white;
  height: 24px;
  border-radius: 20px;
  padding: 12px 16px 12px 16px;
  border: 1px solid $ds-gray-300;
}

.c-autocomplete ::v-deep .v-input__slot {
  margin-bottom: -10px !important;
  border: none !important;
  box-shadow: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  height: 36px !important;
  border-radius: 8px !important;
}

.c-autocomplete ::v-deep .v-autocomplete__content {
  margin-top: -1 !important;
  top: 100% !important;
  border-top: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  border-radius: 0px 0px 8px 8px !important;
  box-shadow: none !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-input__slot {
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 0px solid $ds-gray-300 !important;
  border-radius: 8px 8px 0px 0px !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-menu__content {
  border: 1px solid $ds-blue !important;
  border-top: none !important;
  border-radius: 0 0 8px 8px !important;
}

.c-autocomplete ::v-deep .v-list-item__action {
  display: none !important;
}

::v-deep .v-input {
  border: none;
}

.text-error {
  color: $ds-red;
}

.autocomplete-counter {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background-color: $ds-blue;
  justify-content: center;
}

.day-button-active {
  color: $neutral-basic-white !important;
  background-color: $ds-blue !important;
}
.days-buttons {
  color: #a6a6a6;
  background-color: #eaeaea;
  border-radius: 50%;
  width: 25px;
  height: 25px;
}
</style>
