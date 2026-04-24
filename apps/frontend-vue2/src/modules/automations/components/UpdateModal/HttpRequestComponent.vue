<template>
  <div v-if="render">
    <div class="tab tab-operation d-block">
      <label class="label-title font-12 label-color mb-0">{{ $t('automation.operationType') }}</label>
      <select
        data-cy="automation-message-ippool"
        class="form-control mo-select border-color w-50"
        v-model="selectedOptionData.operation"
        @change="changeSettings('operation', $event.target.value)"
      >
        <option disabled selected value="">{{ $t('automation.selectOperationType') }}</option>
        <option v-for="operation in httpRequestOperations" :value="operation.value" :key="'http-' + operation.value">
          {{ operation.name }}
        </option>
      </select>
    </div>
    <div class="tab">
      <label class="label-title-small mt-4 mb-1">URL</label>
      <input
        class="input-default"
        :placeholder="$t('automation.enterUrl')"
        @input="changeSettings('url', $event.target.value)"
        v-model="url"
      />
      <label class="label-title-small mt-4 mb-1">{{ $t('title.header') }}</label>
      <div v-for="(header, index) in selectedOptionData.headers" :key="index" class="div-header mb-2">
        <input
          class="input-default flex w-50"
          :placeholder="$t('automation.enterKey')"
          :value="header.key"
          @input="updateInput('headers', index, 'key', $event.target.value)"
        />
        <SelectHttpComponent
          :step="header"
          :customFields="customFields"
          :keyItem="'value'"
          :name="'headers'"
          :index="index"
          @updateInput="updateInput"
        />
        <button class="button-trash" @click="deleteItem('headers', index)" type="button" style="z-index: 10">
          <span class="material-symbols-rounded ds-light-gray-color">delete</span>
        </button>
      </div>
      <button class="addition-button font-10 text-600 text-uppercase" type="button" @click="addHeader">
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="mr-1">{{ $t('sidebar.add') }}</span>
      </button>
      <!-- <v-checkbox v-model="selectedOptionData.newTry" @change="changeSettings('newTry', $event)">
        <template v-slot:label>
          <span class="checkbox-span span-tooltip">
            Habilitar nova tentativa
          </span>
        </template>
      </v-checkbox>
      <div v-if="selectedOptionData.newTry">
        <label class="label-title-small mt-1">Número de Tentativas</label>
        <input
          class="input-default w-25"
          :value="selectedOptionData.quantityTry"
          @input="changeSettings('quantityTry', $event.target.value)"
        />
      </div> -->
      <div v-if="selectedOptionData.operation === 'post' || selectedOptionData.operation === 'put'">
        <label class="label-title-small mt-4 mb-1">{{ $t('title.requestBody') }}</label>
        <div class="div-body tab">
          <div v-for="(body, index) in selectedOptionData.body" :key="index" class="body">
            <div class="body-element mb-2">
              <!-- <select
                data-cy="automation-message-ippool"
                class="form-control mo-select border-color"
                v-model="body.type"
                @change="updateInput('body', index, 'type', $event.target.value)"
              >
                <option disabled selected value="">Selecione o tipo</option>
                <option v-for="field in fieldTypes" :value="field.value" :key="'http-' + field.name">
                  {{ field.name }}
                </option>
              </select> -->

              <input
                class="input-default flex w-50"
                :placeholder="$t('automation.enterKey')"
                :value="body.key"
                @input="updateInput('body', index, 'key', $event.target.value)"
              />

              <SelectHttpComponent
                :customFields="customFields"
                :step="body"
                :keyItem="'value'"
                :name="'body'"
                :index="index"
                @updateInput="updateInput"
              />
              <button class="button-trash" @click="deleteItem('body', index)" type="button" style="z-index: 10">
                <span class="material-symbols-rounded ds-light-gray-color">delete</span>
              </button>
            </div>
          </div>
          <button class="addition-button font-10 text-600 text-uppercase" type="button" @click="addBodyProperty">
            <span class="material-symbols-rounded v-icon-plus"> add </span>
            <span class="mr-1">{{ $t('sidebar.add') }}</span>
          </button>
        </div>
      </div>
      <div class="div-row gap-10 align-items-center mt-4">
        <div>
          <label class="label-title-small">{{ $t('automation.test') }}</label>
          <p>{{ $t('automation.infoStartTest') }}</p>
        </div>
        <div>
          <ButtonDefault :name="buttonText" class="initiate-test" @click="sendHttpTest" />
        </div>
      </div>
      <div class="div-column gap-5" v-if="httpLength > 0">
        <div class="div-row gap-10 nav-bar-title">
          <div
            v-for="(returns, index) in returnTypes"
            :key="returns"
            @click="changeReturnType(index)"
            class="cursor-pointer"
          >
            <span class="font-12 text-600" :class="[index === selectedReturnIndex ? 'ds-blue-color' : 'ds-gray-color']">
              {{ returns }}
            </span>
          </div>
        </div>
        <div class="return-console font-12 text-600 ds-white-color">
          <span v-if="inputValue && selectedReturnIndex === 0" v-html="inputValue"></span>
          <div v-if="outputValue && selectedReturnIndex === 1" class="div-column gap-5">
            <span>{{ outputValue.status }}</span>
            <span>{{ outputValue.data }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import CustomFieldsService from '@/modules/customfields/services/customFields.service';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import SelectHttpComponent from './SelectHttpComponent.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: { SelectHttpComponent, ButtonDefault },
  props: ['render', 'step', 'httpReturn'],
})
export default class HttpRequestComponent extends Vue {
  private customFieldService = new CustomFieldsService();
  @Prop() step!: any;
  @Prop() render!: boolean;
  @Prop() httpReturn!: any;

  selectedOptionData: any = {};
  lastHeaderIndex = -1;
  shouldShowBody = true;
  customFields = [];
  url = '';
  selectedReturnIndex = 0;
  inputValue: any = '';
  outputValue: any = { status: '', data: '' };
  httpRequestOperations = [
    { value: 'get', description: '', name: 'GET' },
    { value: 'post', description: '', name: 'POST' },
    { value: 'put', description: '', name: 'PUT' },
    { value: 'delete', description: '', name: 'DELETE' },
  ];
  fieldTypes = [
    { name: 'Texto', value: 'string' },
    { name: 'Número', value: 'number' },
    { name: 'Booleano', value: 'bool' },
  ];
  returnTypes = ['Input', 'Output'];
  httpLength = 0;

  get buttonText() {
    return this.httpLength ? this.$t('automation.restartTest') : this.$t('automation.startTest');
  }

  async beforeMount() {
    this.selectedOptionData = this.step.settings
      ? this.step.settings
      : {
          operation: 'get',
          url: '',
          headers: [],
          body: [],
          queryString: '',
          newTry: false,
          quantityTry: 0,
        };
    this.url = this.selectedOptionData.url;
    this.showModal();
    await this.getCustomFields();
  }

  async getCustomFields() {
    const customFields = (await this.customFieldService.getCustomFields()).data;
    this.customFields = customFields.map((customField: any) => {
      return {
        id: customField.id,
        title: customField.title,
      };
    });
  }

  deleteItem(key: string, index: number) {
    this.selectedOptionData[key].splice(index, 1);
  }

  hideModal() {
    this.$emit('hideModal');
  }

  updateData() {
    this.$emit('updateInfo', this.selectedOptionData);
  }

  changeSettings(key: string, name: string) {
    this.selectedOptionData[key] = name;
    this.updateData();
  }

  changeHeader(index: number, value: string) {
    this.selectedOptionData.headers[index] = value;
    this.updateData();
  }

  updateInput(name: string, index: number, key: string, value: any) {
    this.selectedOptionData[name][index][key] = value;
    this.updateData();
  }

  addHeader() {
    this.selectedOptionData.headers.push({ key: '', value: '' });
    this.lastHeaderIndex++;
    this.updateData();
  }

  addBodyProperty() {
    this.selectedOptionData.body.push({ type: '', key: '', value: '' });
  }

  changeReturnType(index: number) {
    this.selectedReturnIndex = index;
  }

  @Watch('render')
  showModal() {
    if (this.render && this.step?.settings) {
      this.selectedOptionData = this.step?.settings;
    }
  }

  async sendHttpTest() {
    this.$emit('sendHttpTest');
  }

  @Watch('httpReturn')
  checkReturn() {
    this.inputValue = `<pre class="ds-white-color">${JSON.stringify(this.httpReturn.input, null, 2)}</pre>`;
    this.outputValue = { status: `status: ${this.httpReturn.status}`, data: this.httpReturn.data };
    this.httpLength = Object.values(this.httpReturn).length;
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

.c-autocomplete {
  ::v-deep .v-input__control {
    height: auto !important;
    min-height: auto !important;
  }

  ::v-deep .v-input__slot {
    margin: 0 !important;
  }
}

.tab-item-first {
  padding: 16px 14px 0px 16px !important;

  .custom-border {
    position: absolute;
    height: 45px;
    width: 1px;
    background: #d9d9d9;
    margin-top: 10px;
    margin-left: 5px;
  }

  .bigger-border {
    height: 95px;
  }

  .data-list {
    padding-top: 0px !important;
    border: none !important;

    & > p {
      display: flex;
      flex-direction: row;
      align-items: center;
      height: fit-content;
    }
  }

  .circle {
    top: 20px !important;
    z-index: 10;
  }
}

.tab-item-last {
  .custom-border {
    position: absolute;
    height: 24px !important;
    width: 1px;
    background: #d9d9d9;
    margin-top: 0;
    margin-left: 5px;
  }

  .data-list {
    border: none !important;
  }
}

.tab-item.tab-item-first.tab-item-last {
  .custom-border {
    display: none;
  }
}

.tab-item {
  position: relative;
  width: 100%;
  padding: 0px 14px 0px 16px;

  &:hover {
    cursor: pointer;
    background: $ds-gray-100;
  }
}

.tab-item-active {
  background: $ds-blue-100;
  &:hover {
    background: $ds-blue-100 !important;
  }

  .circle {
    background: $ds-blue !important;
  }

  .data-list {
    & > p {
      font-weight: 600;
      color: $ds-blue;
    }
  }
}

.data-list {
  border-left: $ds-gray-300 1.5px solid;
  padding-bottom: 16px;
  padding-top: 20px;
  margin-left: 5px;

  & > p {
    font-size: 14px;
    color: $ds-gray;
    margin-bottom: 0px !important;
    margin-left: 20px;
  }

  & > p:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.circle {
  z-index: 10;
  position: absolute;
  top: 22px;
  left: 17px;
  width: 10px;
  height: 10px;
  background: $ds-gray-300;
  border-radius: 50%;
}

.tab-operation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.operation {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  gap: 8px;

  h3 {
    color: $ds-gray;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 0px !important;
  }

  &:hover {
    cursor: pointer;
    background: $ds-blue-100;

    .icon-operation {
      color: $ds-blue !important;
    }

    h3 {
      color: $ds-blue;
    }
  }
}

.operation-active {
  background: $ds-blue-100;
  .icon-operation {
    color: $ds-blue !important;
  }
  h3 {
    color: $ds-blue;
  }
}

.icon-operation {
  color: $ds-gray !important;
}

.label-title-small {
  font-size: 12px;
  font-weight: bold;
  color: $ds-gray;
}

.div-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.not-last-header {
  margin-right: 36px;
}

.div-body {
  display: flex;
  flex-direction: column;
  justify-items: center;
  width: 100%;
}

.body {
  width: 100%;
}

.body-child {
  width: 100%;
  background: white;
  box-shadow: $shadow-base;
  border-radius: 16px;
  padding: 12px 16px;
  overflow-y: hidden;
  margin-left: 16px;
}

.input-default {
  display: block;
  height: 36px;
  width: 100%;
  padding: 2px 12px;
  border: $ds-gray-300 1px solid;
  border-radius: 8px;
  font-size: 12px;
  color: $ds-gray;

  &:focus {
    border-color: $ds-blue;
    outline: none;
  }
}

.addition-button {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: normal;
  height: 24px !important;
  width: 100px !important;
  padding: 6px 8px 6px 8px;
  background-color: #0fb75c;
  border-radius: 24px;
  color: white;
}
.add {
  font-size: 16px;
  color: white !important;
}
.span-tooltip {
  display: flex;
  margin-top: 5px;
}
.body-element {
  display: flex;
  width: 100%;
  gap: 10px;
}

.button-trash {
  margin-bottom: -8px;
}

.initiate-test {
  height: 26px !important;
  border-radius: 8px;
  border: 1px solid $ds-blue !important;
  padding: 8px 12px 8px 12px !important;
  color: $ds-blue !important;
  background-color: $neutral-basic-white !important;
  font-size: 10px !important;
  font-weight: 600;
  box-shadow: none !important;
  &:hover {
    background-color: $ds-blue-100 !important;
  }
}

.nav-bar-title {
  box-shadow:
    0px 1px 3px 0px #0000001a,
    0px 1px 2px 0px #0000000f;
  padding: 16px;
  border-radius: 16px;
}

.return-console {
  border-radius: 8px;
  min-height: 150px;
  background-color: $ds-gray;
  padding: 10px;
}
</style>
