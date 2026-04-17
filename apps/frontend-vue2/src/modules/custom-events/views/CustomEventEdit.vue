<template>
  <div class="view-new-custom-event col-12 pt-0">
    <v-card class="background-card d-flex div-column gap-20 card-name-description">
      <InputDefault
        :name="`${$t('title.name')}`"
        data-cy="message-new-title"
        autofocus
        :modelValue="currentCustomEvent.name"
        :placeholder="`${$t('input.customEventName')}`"
        @updateInput="updateInput"
        :keyInput="'name'"
        :disabled="isDefault"
        max="40"
      />
      <InputDefault
        data-cy="message-new-description"
        autofocus
        max="500"
        :name="`${$t('create.description')}`"
        :modelValue="currentCustomEvent.description"
        :placeholder="`${$t('input.customEventDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
        :disabled="isDefault"
      />
    </v-card>
    <span class="font-16 ds-gray-color text-600 title-spacing">{{ $t('title.properties') }}</span>
    <v-card class="background-card d-flex div-column card-name-description mt-2">
      <div
        class="d-flex w-50 mb-2"
        v-for="(properties, index) in currentCustomEvent.properties"
        :key="'custom-properties-' + index"
      >
        <div class="mr-2 w-50">
          <label class="label-title font-12 label-color mb-1">{{ $t('datatable.type') }}</label>
          <select
            class="form-control mo-select border-color font-12"
            @change="updateProperty($event.target.value, index, true)"
            :value="properties.type"
          >
            <option disabled selected value="">{{ $t('input.selectType') }}</option>
            <option
              v-for="eventType in eventsType"
              :value="eventType.value"
              :key="'custom-event-' + index + eventType.value"
            >
              {{ eventType.name }}
            </option>
          </select>
        </div>
        <InputDefault
          autofocus
          max="500"
          :name="`${$t('input.name')}`"
          :modelValue="properties.name"
          :placeholder="`${$t('input.customEventNameProperty')}`"
          :keyInput="`${index}`"
          @updateInput="updateProperty"
        />
      </div>
      <button class="addition-button font-10 text-600 text-uppercase" type="button" @click="addProperty">
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="mr-1">{{ $t('sidebar.add') }}</span>
      </button>
    </v-card>
    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/custom-events')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="`${$t('button.create')}`"
        @click="buttonSave"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import ServicesService from '@/modules/messages/services/services.service';
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import { CustomEventDto } from '../dtos/custom-event.dto';
import CustomEventService from '../services/custom-event.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: { InputDefault, ButtonDefault },
  providers: [LoadingService, ServicesService],
})
export default class CustomEventEdit extends Vue {
  private readonly customEventService = new CustomEventService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();

  currentCustomEvent: CustomEventDto = { properties: [] } as CustomEventDto;
  eventsType = [
    { name: this.$t('input.string'), value: 'string' },
    { name: this.$t('input.numeric'), value: 'number' },
    { name: this.$t('input.boolean'), value: 'bool' },
  ];
  isDefault = false;
  beforeMount() {
    this.getCustomEvent();
  }

  async getCustomEvent() {
    const customEventId = +this.$route.params.custom_event_id;
    if (customEventId) {
      const customEvent = (await this.customEventService.getCustomEventById(customEventId))?.data;
      this.currentCustomEvent = { ...customEvent, properties: customEvent.properties || [] };
    }
  }

  async newCustomEvent() {
    return await this.customEventService.createCustomEvent(this.currentCustomEvent);
  }

  async updateCustomEvent(id: number) {
    return await this.customEventService.updateCustomEvent(id, this.currentCustomEvent);
  }

  updateInput(event: never, key: keyof CustomEventDto) {
    this.currentCustomEvent[key] = event;
  }

  addProperty() {
    this.currentCustomEvent.properties.push({});
  }

  updateProperty(value: never, key: string, isType = false) {
    if (isType) {
      this.currentCustomEvent.properties[parseInt(key, 10)]['type'] = value;
    } else {
      this.currentCustomEvent.properties[parseInt(key, 10)]['name'] = value;
    }
  }

  async buttonSave() {
    let response;
    if (this.currentCustomEvent && this.currentCustomEvent.id) {
      response = await this.updateCustomEvent(this.currentCustomEvent.id);
    } else {
      response = await this.newCustomEvent();
    }

    if (response && response.data && response.data.id) {
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.customEventSaved') as string,
      });

      this.$router.push(`/custom-events`);
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep.view-new-custom-event {
  width: 100%;
}
::v-deep.v-card > *:last-child:not(.v-btn):not(.v-chip) {
  border-bottom-left-radius: 24px !important;
  border-bottom-right-radius: 24px !important;
}
.addition-button {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: normal;
  height: 24px !important;
  width: 100px !important;
  padding: 4px 8px 6px 8px;
  background-color: #0fb75c;
  border-radius: 24px !important;
  color: white;
}
.add {
  font-size: 16px;
  color: white !important;
}
</style>
