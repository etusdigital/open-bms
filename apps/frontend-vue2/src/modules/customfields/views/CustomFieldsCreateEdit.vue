<template>
  <div class="view-new-tag col-12 pt-0 mt-2">
    <span class="font-16 text-600 ds-gray-color">{{ $t('title.details') }}</span>
    <v-card class="div-row card-name-desc mb-5 mt-2">
      <InputDefault
        data-cy="custom-field-new-title"
        autofocus
        max="40"
        :name="`${$t('title.name')}`"
        :modelValue="currentCustomField.title"
        :placeholder="`${$t('input.fieldName')}`"
        :keyInput="'title'"
        @updateInput="updateInput"
        class="col-4"
      />
      <InputDefault
        data-cy="custom-field-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="currentCustomField.description"
        :placeholder="`${$t('input.fieldDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
        class="col-8"
      />
    </v-card>

    <span class="font-16 text-600 ds-gray-color">{{ $t('title.fieldType') }}</span>
    <div class="fields-cards-wrapper">
      <div class="div-row justify-space-between mt-2 mb-5 fields-cards-specs gap-20">
        <div
          v-for="(card, index) in fieldsCards"
          :key="card.type"
          @click="selectCard(index)"
          class="fields-cards div-row align-items-center"
          :class="{ 'border-blue': index === selectedCardIndex, 'card-disabled': currentCustomField.id > 0 }"
        >
          <span
            class="material-symbols-rounded font-36 ds-gray-color"
            :class="{ 'ds-blue-color': index === selectedCardIndex }"
          >
            {{ card.icon }}
          </span>
          <span class="font-14 text-600" :class="[index === selectedCardIndex ? 'ds-blue-color' : 'ds-gray-color']">
            {{ card.title }}
          </span>
        </div>
      </div>
    </div>

    <span class="font-16 text-600 ds-gray-color">{{ $t('title.additionalSettings') }}</span>
    <div class="config-card mt-2 mb-5 div-column">
      <CustomFieldsSettings
        :customType="selectedFieldType"
        :currentCustomField="currentCustomField"
        @updateInput="updateInput"
      />
    </div>

    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/customfields')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="`${$t('button.create')}`"
        data-cy="automation-message-save-btn"
        @click="buttonSave"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import ServicesService from '@/modules/messages/services/services.service';
import LoadingService from '@/services/loading.service';
import ToastService from '@/services/toast.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import CustomFieldsSettings from '../components/CustomFieldsSettings.vue';
import { CustomFieldsDto } from '../dtos/customFieldsdto';
import CustomFieldsService from '../services/customFields.service';

@Component({
  components: { InputDefault, ButtonDefault, CustomFieldsSettings },
  providers: [LoadingService, ServicesService],
})
export default class CustomFieldsCreateEdit extends Vue {
  private readonly customFieldsService = new CustomFieldsService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();

  currentCustomField: CustomFieldsDto = { type: 'text', attributionType: 'first' } as CustomFieldsDto;
  selectedCardIndex = 0;
  selectedFieldType: any = '';
  selectedSettingIndex = 0;
  fieldsCards = [
    {
      title: this.$t('title.text'),
      icon: 'title',
      type: 'text',
    },
    {
      title: this.$t('input.number'),
      icon: 'tag',
      type: 'number',
    },
    {
      title: this.$t('datatable.date'),
      icon: 'calendar_month',
      type: 'date',
    },
    {
      title: this.$t('input.selectList'),
      icon: 'lists',
      type: 'list',
    },
    {
      title: this.$t('input.file'),
      icon: 'draft',
      type: 'file',
    },
  ];

  async beforeMount() {
    await this.getCustomField();
    this.selectedFieldType = this.currentCustomField.type ? this.currentCustomField.type : 'text';
    this.selectedCardIndex = this.currentCustomField.type
      ? this.fieldsCards.findIndex((value: any) => value.type === this.currentCustomField.type)
      : 0;
  }

  async getCustomField() {
    const accountId = +this.$route.params.account_id;
    if (accountId) {
      this.currentCustomField = (await this.customFieldsService.getCustomFieldById(accountId))?.data;
    }
  }

  async newCustomField() {
    return await this.customFieldsService.createCustomField(this.currentCustomField);
  }

  async updateCustomField(id: number) {
    return await this.customFieldsService.updateCustomField(id, this.currentCustomField);
  }

  updateInput(event: never, key: keyof CustomFieldsDto) {
    this.currentCustomField[key] = event;
  }

  selectCard(index: number) {
    if (this.currentCustomField.id) {
      return;
    }
    const newFieldType = this.fieldsCards[index].type;
    this.selectedFieldType = newFieldType;
    this.selectedCardIndex = index;
    this.currentCustomField.type = newFieldType;
    this.currentCustomField.label = null;
    this.currentCustomField.placeholder = null;
    this.currentCustomField.fieldFormat = null;
    this.currentCustomField.characterLimit = null;
    this.currentCustomField.mask = null;
    this.currentCustomField.decimalLength = null;
    this.currentCustomField.options = null;
    this.currentCustomField.fileFormats = null;
  }

  async buttonSave() {
    try {
      this.loadingService.show();
      let response;
      if (this.currentCustomField && this.currentCustomField.id) {
        response = await this.updateCustomField(this.currentCustomField.id);
      } else {
        response = await this.newCustomField();
      }
      this.loadingService.hide();
      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('modal.customFieldSaved') as string,
        });

        this.$router.push(`/customfields`);
      }
    } catch (error) {
      this.loadingService.hide();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.card-name-desc {
  padding: 10px;
  border-radius: 16px;
}

.config-card {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.fields-cards {
  width: 100%;
  padding: 20px 16px;
  align-items: center;
  border-radius: 16px;
  gap: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  border: 1px solid #d9d9d9;
  background: #ffffff;
}

.border-blue {
  border: 1px solid $ds-blue !important;
  background: #f4f8ff !important;
  opacity: 1 !important;
}

.select-card {
  white-space: nowrap;
}

.fields-cards-wrapper {
  container-type: inline-size;
  container-name: fields-cards-specs;
}

.fields-cards-specs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

input[type='radio'] {
  accent-color: $ds-blue;
}

.label-settings {
  margin-top: -2px;
}

@container fields-cards-specs (max-width: 1000px) {
  .fields-cards-specs {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}
::v-deep.view-new-tag {
  width: 100%;
}
.card-disabled {
  background-color: #e9e9e900;
  border: 2px solid #d9d9d9;
  opacity: 0.5;
}
</style>
