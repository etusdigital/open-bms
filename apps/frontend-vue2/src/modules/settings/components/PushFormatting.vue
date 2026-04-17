<template>
  <v-card class="push-desktop-format pb-5">
    <div class="push-formatting pb-2">
      <div>
        <label class="label-title-small">{{ $t('title.display') }}</label>
        <v-menu
          ref="menu"
          v-model="showTemplate"
          class="select-menu"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
          width="100%"
        >
          <template v-slot:activator="{ on }">
            <v-btn
              class="select-button"
              :class="{ 'select-button-open': showTemplate === true }"
              v-on="on"
              @click="showTemplate = true"
            >
              <div class="menu" v-on="on">
                <p :class="{ 'menu-open': showTemplate === true }" style="display: flex; flex-direction: row">
                  {{ selectedTemplate }}
                </p>
              </div>
              <div>
                <span
                  class="material-symbols-rounded icon-up"
                  :class="{ 'icon-dropdown ds-blue-color': showTemplate === true }"
                >
                  arrow_drop_down
                </span>
              </div>
            </v-btn>
          </template>
          <v-card width="100%" class="select-card" :class="{ 'select-card-open': showTemplate === true }">
            <div
              class="select-options p-2 div-row justify-space-between select-template"
              v-for="(template, index) in templateOptions"
              :value="template.name"
              :key="template.name"
              @click="changeTemplate(index)"
            >
              <div class="option-template text-400 font-12" :class="!templateOptions[index + 1] ? 'last-item' : ''">
                {{ template.value }}
              </div>
              <div class="mr-2">
                <img :src="template.img" />
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
      <div v-if="selectedTemplate !== $t('input.native')" class="mt-5 div-more-items">
        <div style="position: relative; width: 50%">
          <label class="label-title-small">{{ $t('input.position') }}</label>
          <v-menu
            ref="menu"
            v-model="showPushPosition"
            class="select-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="100%"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                class="select-button"
                :class="{ 'select-button-open': showPushPosition === true }"
                v-on="on"
                @click="showPushPosition = true"
              >
                <div class="menu" v-on="on">
                  <p :class="{ 'menu-open': showPushPosition === true }" style="display: flex; flex-direction: row">
                    {{ selectedPosition }}
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showPushPosition === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="100%" class="select-card" :class="{ 'select-card-open': showPushPosition === true }">
              <div
                class="select-options"
                v-for="(position, index) in positionOptions"
                :value="position.name"
                :key="position.name"
              >
                <div
                  class="option"
                  @click="changePosition(index)"
                  :class="!positionOptions[index + 1] ? 'last-item' : ''"
                >
                  {{ position.value }}
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
        <div style="width: 50%">
          <label class="label-title-small">{{ $t('input.backgroundColor') }}</label>
          <div style="position: relative">
            <input
              type="color"
              class="input-color"
              @input="changeProperty('push', 'background', $event.target.value)"
              v-model="selectedBackgroundColor"
            />
            <input
              type="text"
              class="input-style"
              maxlength="7"
              @input="changeBackgroundColor($event.target.value)"
              v-model="selectedBackgroundColor"
              style="text-transform: uppercase"
            />
          </div>
        </div>
      </div>
      <div :class="[selectedTemplate === $t('input.native') ? '' : 'div-last-item']">
        <label class="label-title-small mt-5">Trigger</label>
        <div v-for="(trigger, index) in triggerOptions" :key="trigger.name">
          <div class="trigger-options" :class="{ 'mt-2': index > 0 }">
            <input
              type="radio"
              :id="`trigger-option-${trigger.name}`"
              name="trigger-options"
              class="cursor-pointer"
              :value="trigger.name"
              @click="changeTriggerOption(index, trigger.number)"
              :checked="index === selectedTrigger"
            />
            <label
              :for="`trigger-option-${trigger.name}`"
              class="m-0 cursor-pointer"
              :class="{ 'choose-option': index === selectedTrigger }"
              >{{ trigger.value }}</label
            >
          </div>
          <div class="pt-2 div-row hour-select align-center mt-1">
            <input
              class="input-number font-14 pl-2 input-size icon-up input-after"
              type="number"
              :class="{ 'disable-input': index !== selectedTrigger }"
              v-model="trigger.number"
              min="1"
              :disabled="trigger.name !== scriptType"
              @input="changeScript(trigger.name, $event.target.value)"
            />
            <div class="div-column pb-2">
              <button
                class="button-number d-flex hour-select"
                type="button"
                v-on:click.prevent="
                  () => {
                    trigger.number += 1;
                    changeScript(trigger.name, trigger.number);
                  }
                "
                :disabled="trigger.name !== scriptType"
              >
                <span class="material-symbols-rounded icon-up" medium>arrow_drop_up</span>
              </button>
              <button
                class="button-number d-flex hour-select"
                type="button"
                v-on:click.prevent="
                  () => {
                    trigger.number >= 1 ? (trigger.number -= 1) : 1;
                    changeScript(trigger.name, trigger.number);
                  }
                "
                :disabled="trigger.name !== scriptType"
              >
                <span class="material-symbols-rounded icon-up" medium>arrow_drop_down</span>
              </button>
            </div>
            <span class="font-12 text-400 span-ends pl-1" style="font-size: 12px">{{ trigger.text }}</span>
          </div>
        </div>
      </div>

      <AlertComponent
        type="warning"
        :show-icon="false"
        class="mb-3 mt-3"
        v-if="selectedTemplate === $t('input.native')"
      >
        <div v-html="`${$t('alert.nativePushAlert')}`"></div>
      </AlertComponent>

      <div v-if="selectedTemplate !== $t('input.native')" class="div-first-item div-last-item">
        <label class="label-title-small">{{ $t('input.bordersTemplate') }}</label>
        <div class="div-more-items" style="gap: 4px">
          <div
            class="box-div"
            :class="{ 'box-active': pushHasBorderRadius }"
            @click="
              () => {
                pushHasBorderRadius = true;
                changeProperty('push', 'border-radius', '16px');
              }
            "
          >
            <span class="border-radius border-item"></span>
          </div>
          <div
            class="box-div"
            :class="{ 'box-active': !pushHasBorderRadius }"
            @click="
              () => {
                pushHasBorderRadius = false;
                changeProperty('push', 'border-radius', '0px');
              }
            "
          >
            <span class="border-item"></span>
          </div>
        </div>
        <div style="display: flex; align-items: center" class="mt-4">
          <input
            type="checkbox"
            id="pushHasBorder"
            class="cursor-pointer"
            v-model="pushHasBorder"
            @input="
              pushHasBorder
                ? changeProperty('push', 'border', 'none')
                : changeProperty('push', 'border', selectedBorderColor + ' 2px solid')
            "
          />
          <label
            for="pushHasBorder"
            class="font-12 text-400 pl-2 cursor-pointer"
            style="font-size: 12px; margin-bottom: 0px"
          >
            {{ $t('input.popupWithBorder') }}
          </label>
        </div>
        <label class="label-title-small mt-4">{{ $t('input.borderColor') }}</label>
        <div style="position: relative; width: 50%">
          <input
            type="color"
            class="input-color"
            :class="{ 'disable-input': !pushHasBorder }"
            :disabled="!pushHasBorder"
            @input="changeProperty('push', 'border', $event.target.value + ' 2px solid')"
            v-model="selectedBorderColor"
          />
          <input
            type="text"
            class="input-style"
            :class="{ 'disable-input': !pushHasBorder }"
            :disabled="!pushHasBorder"
            maxlength="7"
            @input="changeBorderColor($event.target.value)"
            v-model="selectedBorderColor"
            style="text-transform: uppercase"
          />
        </div>
      </div>
      <div v-if="selectedTemplate !== $t('input.native')" class="div-first-item div-last-item">
        <div class="d-flex justify-space-between">
          <label class="label-title-small">{{ $t('datatable.title') }}</label>
          <span class="font-12 text-400" style="font-size: 12px; color: #d9d9d9">{{ pushStyle.title.length }}/60</span>
        </div>
        <input
          v-model="pushStyle.title"
          @input="changeText('title', $event.target.value)"
          class="input-style"
          maxlength="60"
        />
        <label class="label-title-small mt-4">{{ $t('input.subTitle') }}</label>
        <textarea class="input-style" v-model="pushStyle.subTitle"></textarea>
        <label class="label-title-small mt-4">{{ $t('input.textColor') }}</label>
        <div style="position: relative; width: 50%">
          <input
            type="color"
            class="input-color"
            @input="changeProperty('textColor', 'color', $event.target.value)"
            v-model="selectedTextColor"
          />
          <input
            type="text"
            class="input-style"
            maxlength="7"
            @input="changeTextColor($event.target.value)"
            v-model="selectedTextColor"
            style="text-transform: uppercase"
          />
        </div>
      </div>
      <div v-if="selectedTemplate !== $t('input.native')" class="div-first-item div-last-item">
        <div>
          <label class="label-title" style="font-size: 14px">{{ $t('input.permissionButton') }}</label>
        </div>
        <label class="label-title-small mt-4">{{ $t('input.text') }}</label>
        <input
          v-model="pushStyle.permissionButtonText"
          @input="changeText('permissionButtonText', $event.target.value)"
          class="input-style"
        />
        <div class="div-more-items mt-4">
          <div width="50%">
            <label class="label-title-small">{{ $t('input.backgroundColor') }}</label>
            <div style="position: relative">
              <input
                type="color"
                class="input-color"
                @input="changeProperty('permissionButton', 'background', $event.target.value)"
                v-model="selectedBackgroundColorPermission"
              />
              <input
                type="text"
                class="input-style"
                maxlength="7"
                @input="changeButtonBackgroundColor(true, $event.target.value)"
                v-model="selectedBackgroundColorPermission"
                style="text-transform: uppercase"
              />
            </div>
          </div>
          <div width="50%">
            <label class="label-title-small">{{ $t('input.textColor') }}</label>
            <div style="position: relative">
              <input
                type="color"
                class="input-color"
                @input="changeProperty('permissionButton', 'color', $event.target.value)"
                v-model="selectedTextColorPermission"
              />
              <input
                type="text"
                class="input-style"
                maxlength="7"
                @input="changeButtonTextColor(true, $event.target.value)"
                v-model="selectedTextColorPermission"
                style="text-transform: uppercase"
              />
            </div>
          </div>
        </div>
        <label class="label-title-small mt-4">{{ $t('input.bordersTemplate') }}</label>
        <div class="div-more-items" style="gap: 4px">
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusPermission === '100px' }"
            @click="
              () => {
                buttonBorderRadiusPermission = '100px';
                changeProperty('permissionButton', 'border-radius', '100px');
              }
            "
          >
            <span class="border-circle border-item"></span>
          </div>
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusPermission === '8px' }"
            @click="
              () => {
                buttonBorderRadiusPermission = '8px';
                changeProperty('permissionButton', 'border-radius', '8px');
              }
            "
          >
            <span class="border-radius border-item"></span>
          </div>
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusPermission === '0px' }"
            @click="
              () => {
                buttonBorderRadiusPermission = '0px';
                changeProperty('permissionButton', 'border-radius', '0px');
              }
            "
          >
            <span class="border-item"></span>
          </div>
        </div>
        <div style="display: flex; align-items: center" class="mt-4">
          <input
            type="checkbox"
            id="permissionHasBorder"
            class="cursor-pointer"
            v-model="permissionHasBorder"
            @input="
              permissionHasBorder
                ? changeProperty('permissionButton', 'border', 'none')
                : changeProperty('permissionButton', 'border', selectedBorderColorPermission + ' 2px solid')
            "
          />
          <label
            for="permissionHasBorder"
            class="font-12 text-400 pl-2 cursor-pointer"
            style="font-size: 12px; margin-bottom: 0px"
          >
            {{ $t('input.buttonWithBorder') }}
          </label>
        </div>

        <label class="label-title-small mt-4">{{ $t('input.borderColor') }}</label>
        <div style="position: relative; width: 50%">
          <input
            type="color"
            class="input-color"
            :class="{ 'disable-input': !permissionHasBorder }"
            :disabled="!permissionHasBorder"
            @input="changeProperty('permissionButton', 'border', $event.target.value + ' 2px solid')"
            v-model="selectedBorderColorPermission"
          />
          <input
            type="text"
            class="input-style"
            :class="{ 'disable-input': !permissionHasBorder }"
            :disabled="!permissionHasBorder"
            maxlength="7"
            @input="changeButtonBorderColor(true, $event.target.value)"
            v-model="selectedBorderColorPermission"
            style="text-transform: uppercase"
          />
        </div>
      </div>
      <div v-if="selectedTemplate !== $t('input.native')" class="div-first-item div-last-item">
        <div>
          <label class="label-title" style="font-size: 14px">{{ $t('input.denyButton') }}</label>
        </div>
        <label class="label-title-small mt-4">{{ $t('input.text') }}</label>
        <input
          v-model="pushStyle.denyButtonText"
          @input="changeText('denyButtonText', $event.target.value)"
          class="input-style"
        />
        <div class="div-more-items mt-4">
          <div width="50%">
            <label class="label-title-small">{{ $t('input.backgroundColor') }}</label>
            <div style="position: relative">
              <input
                type="color"
                class="input-color"
                @input="changeProperty('denyButton', 'background', $event.target.value)"
                v-model="selectedBackgroundColorDeny"
              />
              <input
                type="text"
                class="input-style"
                maxlength="7"
                @input="changeButtonBackgroundColor(false, $event.target.value)"
                v-model="selectedBackgroundColorDeny"
                style="text-transform: uppercase"
              />
            </div>
          </div>
          <div width="50%">
            <label class="label-title-small">{{ $t('input.textColor') }}</label>
            <div style="position: relative">
              <input
                type="color"
                class="input-color"
                @input="changeProperty('denyButton', 'color', $event.target.value)"
                v-model="selectedTextColorDeny"
              />
              <input
                type="text"
                class="input-style"
                maxlength="7"
                @input="changeButtonTextColor(false, $event.target.value)"
                v-model="selectedTextColorDeny"
                style="text-transform: uppercase"
              />
            </div>
          </div>
        </div>
        <label class="label-title-small mt-4">{{ $t('input.bordersTemplate') }}</label>
        <div class="div-more-items" style="gap: 4px">
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusDeny === '100px' }"
            @click="
              () => {
                buttonBorderRadiusDeny = '100px';
                changeProperty('denyButton', 'border-radius', '100px');
              }
            "
          >
            <span class="border-circle border-item"></span>
          </div>
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusDeny === '8px' }"
            @click="
              () => {
                buttonBorderRadiusDeny = '8px';
                changeProperty('denyButton', 'border-radius', '8px');
              }
            "
          >
            <span class="border-radius border-item"></span>
          </div>
          <div
            class="box-div"
            :class="{ 'box-active': buttonBorderRadiusDeny === '0px' }"
            @click="
              () => {
                buttonBorderRadiusDeny = '0px';
                changeProperty('denyButton', 'border-radius', '0px');
              }
            "
          >
            <span class="border-item"></span>
          </div>
        </div>
        <div style="display: flex; align-items: center" class="mt-4">
          <input
            type="checkbox"
            id="denyHasBorder"
            class="cursor-pointer"
            v-model="denyHasBorder"
            @input="
              denyHasBorder
                ? changeProperty('denyButton', 'border', 'none')
                : changeProperty('denyButton', 'border', selectedBorderColorDeny + ' 2px solid')
            "
          />
          <label
            for="denyHasBorder"
            class="font-12 text-400 pl-2 cursor-pointer"
            style="font-size: 12px; margin-bottom: 0px"
          >
            {{ $t('input.buttonWithBorder') }}
          </label>
        </div>

        <label class="label-title-small mt-4">{{ $t('input.borderColor') }}</label>
        <div style="position: relative; width: 50%">
          <input
            type="color"
            class="input-color"
            :class="{ 'disable-input': !denyHasBorder }"
            :disabled="!denyHasBorder"
            @input="changeProperty('denyButton', 'border', $event.target.value + ' 2px solid')"
            v-model="selectedBorderColorDeny"
          />
          <input
            type="text"
            class="input-style"
            :class="{ 'disable-input': !denyHasBorder }"
            :disabled="!denyHasBorder"
            maxlength="7"
            @input="changeButtonBorderColor(false, $event.target.value)"
            v-model="selectedBorderColorDeny"
            style="text-transform: uppercase"
          />
        </div>
      </div>
      <div v-if="selectedTemplate !== $t('input.native')" class="div-first-item pb-5">
        <div style="display: flex; align-items: center" class="mt-4">
          <input
            type="checkbox"
            id="showImage"
            class="cursor-pointer"
            v-model="showImage"
            @input="
              showImage
                ? changeProperty('logoStyle', 'display', 'none')
                : changeProperty('logoStyle', 'display', 'block')
            "
          />
          <label
            for="showImage"
            class="font-12 text-400 pl-2 cursor-pointer"
            style="font-size: 12px; margin-bottom: 0px"
            >{{ $t('input.showImage') }}</label
          >
        </div>
        <div
          class="mt-4 image-area"
          v-if="showImage"
          :style="selectedTemplate === $t('input.bar') ? 'padding: 5px 20px;' : ''"
        >
          <div class="drop-actions" :style="selectedTemplate === $t('input.bar') ? 'margin-top: 10px;' : ''">
            <div v-if="currentState === 'empty'">
              <div
                :class="['dropZone dash-blue', dragging ? 'dropZone-over' : '']"
                @dragenter="dragging = true"
                @dragleave="dragging = false"
                @drag="onChangeImage"
              >
                <img src="@/assets/import-contact-file.svg" alt="Select a file" width="64px" height="64px" />
                <span class="dropZone-title mt-4">{{ $t('title.uploadFile') }}</span>
                <span class="dropZone-title-drag mt-2">{{ $t('title.dragDrop') }}</span>

                <input class="file-drag" type="file" ref="inputFile" accept="image/*" @change="onChangeImage" />
              </div>
            </div>
            <div class="div-show-image" v-else>
              <div class="div-image">
                <img :src="logoImage" alt="Logo image" width="64px" height="64px" />
              </div>
              <button class="button-trash" @click="removeImage" type="button">
                <span class="material-symbols-rounded ds-light-gray-color">delete</span>
              </button>
            </div>
          </div>
          <div v-if="selectedTemplate !== $t('input.bar')">
            <label class="label-title-small">{{ $t('title.display') }}</label>
            <v-menu
              ref="menu"
              v-model="showImagePosition"
              class="select-menu"
              :close-on-content-click="false"
              bottom
              transition="scale-y-transition"
              offset-y
              width="100%"
            >
              <template v-slot:activator="{ on }">
                <v-btn
                  class="select-button"
                  :class="{ 'select-button-open': showImagePosition === true }"
                  v-on="on"
                  @click="showImagePosition = true"
                >
                  <div class="menu" v-on="on">
                    <p :class="{ 'menu-open': showImagePosition === true }" style="display: flex; flex-direction: row">
                      {{ selectedImagePosition }}
                    </p>
                  </div>
                  <div>
                    <span
                      class="material-symbols-rounded icon-up"
                      :class="{ 'icon-dropdown ds-blue-color': showImagePosition === true }"
                    >
                      arrow_drop_down
                    </span>
                  </div>
                </v-btn>
              </template>
              <v-card width="100%" class="select-card" :class="{ 'select-card-open': showImagePosition === true }">
                <div
                  class="select-options"
                  v-for="(position, index) in imagePositions"
                  :value="position.name"
                  :key="position.name"
                >
                  <div
                    class="option"
                    @click="changeImagePosition(index)"
                    :class="!imagePositions[index + 1] ? 'last-item' : ''"
                  >
                    {{ position.value }}
                  </div>
                </div>
              </v-card>
            </v-menu>
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import AddStepButtonComponent from '@/components/add-step-button/AddStepButtonComponent.vue';
import ToastService from '@/services/toast.service';
import ApiService from '@/services/api.service';
import AlertComponent from '@/components/alert/AlertComponent.vue';

@Component({
  components: { ButtonDefault, InputDefault, AddStepButtonComponent, AlertComponent },
  props: ['pushStyle', 'scriptType', 'pushScriptValue', 'pushSettings'],
})
export default class PushFormatting extends Vue {
  private readonly toastService = new ToastService();
  private readonly apiService = new ApiService();

  @Prop() pushStyle!: any;
  @Prop() pushScriptValue!: any;
  @Prop() scriptType!: string;
  @Prop() pushSettings!: any;
  showTemplate = false;
  showPushPosition = false;
  selectedTemplate!: string;
  templateOptions = [
    { value: this.$t('input.default'), name: 'default', img: require('@/assets/widebox.svg') },
    { value: this.$t('input.bar'), name: 'bar', img: require('@/assets/bar.svg') },
    { value: this.$t('input.native'), name: 'native', img: require('@/assets/native.svg') },
  ];
  selectedPosition!: string;
  positionOptions = [
    { value: this.$t('input.top'), name: 'top' },
    { value: this.$t('input.footer'), name: 'footer' },
  ];
  selectedBackgroundColor!: string;
  accessNumber!: number;
  percentNumber!: number;
  inactiveNumber!: number;
  triggerOptions: any = [];
  selectedTrigger!: number;
  pushHasBorderRadius!: boolean;
  pushHasBorder!: boolean;
  selectedBorderColor!: string;
  selectedTextColor!: string;
  selectedTextColorPermission!: string;
  selectedBackgroundColorPermission!: string;
  selectedBorderColorPermission!: string;
  buttonBorderRadiusPermission!: string;
  permissionHasBorder!: boolean;
  selectedTextColorDeny!: string;
  selectedBackgroundColorDeny!: string;
  selectedBorderColorDeny!: string;
  buttonBorderRadiusDeny!: string;
  denyHasBorder!: boolean;
  showImage!: boolean;
  showImagePosition = false;
  selectedImagePosition!: string;
  imagePositions = [
    { value: this.$t('input.left'), name: 'left' },
    { value: this.$t('input.right'), name: 'right' },
  ];
  currentState = 'empty';
  logoImage!: any;
  dragging = false;

  beforeMount() {
    this.selectedTemplate = `${this.$t('input.' + this.pushSettings.template)}`;
    this.selectedPosition =
      this.pushStyle.push.top === 1 ? (this.$t('input.footer') as string) : (this.$t('input.top') as string);
    this.selectedBackgroundColor = this.pushStyle.push.background;
    this.accessNumber =
      this.scriptType === 'access' && this.pushScriptValue.match(/const scriptValue = (\d+);/)
        ? parseInt(this.pushScriptValue.match(/const scriptValue = (\d+);/)[1], 10)
        : 0;
    this.percentNumber =
      this.scriptType === 'percentScroll' && this.pushScriptValue.match(/const scriptValue = (\d+);/)
        ? parseInt(this.pushScriptValue.match(/const scriptValue = (\d+);/)[1], 10)
        : 0;
    this.inactiveNumber =
      this.scriptType === 'inactive' && this.pushScriptValue.match(/const scriptValue = (\d+);/)
        ? parseInt(this.pushScriptValue.match(/const scriptValue = (\d+);/)[1], 10)
        : 0;
    this.triggerOptions = [
      {
        value: this.$t('input.inAccess'),
        name: 'access',
        number: this.accessNumber / 1000,
        text: this.$t('input.secLate'),
      },
      {
        value: this.$t('input.scrollPercent'),
        name: 'percentScroll',
        number: this.percentNumber,
        text: this.$t('input.screenScroll'),
      },
      {
        value: this.$t('input.dueInactivity'),
        name: 'inactive',
        number: this.inactiveNumber / 1000,
        text: this.$t('input.secInactive'),
      },
    ];
    this.selectedTrigger = this.triggerOptions.findIndex((x: any) => x.name === this.scriptType);
    this.pushHasBorderRadius = this.pushStyle.push['border-radius'] !== '0px';
    this.pushHasBorder = this.pushStyle.push.border !== 'none';
    this.selectedBorderColor = this.pushStyle.push.border.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)
      ? this.pushStyle.push.border.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)[0]
      : '#ffffff';
    this.selectedTextColor = this.pushStyle.textColor.color;
    this.selectedTextColorPermission = this.pushStyle.permissionButton.color;
    this.selectedBackgroundColorPermission = this.pushStyle.permissionButton.background;
    this.selectedBorderColorPermission = this.pushStyle.permissionButton.border.match(
      /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/
    )
      ? this.pushStyle.permissionButton.border.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)[0]
      : '#ffffff';
    this.buttonBorderRadiusPermission = this.pushStyle.permissionButton['border-radius'] || '0px';
    this.permissionHasBorder = this.pushStyle.permissionButton.border !== 'none';
    this.selectedTextColorDeny = this.pushStyle.denyButton.color;
    this.selectedBackgroundColorDeny = this.pushStyle.denyButton.background;
    this.selectedBorderColorDeny = this.pushStyle.denyButton.border.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)
      ? this.pushStyle.denyButton.border.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)[0]
      : '#ffffff';
    this.buttonBorderRadiusDeny = this.pushStyle.denyButton['border-radius'] || '0px';
    this.denyHasBorder = this.pushStyle.denyButton.border !== 'none';
    this.showImage = this.pushStyle.logoStyle.display !== 'none';
    this.selectedImagePosition = /reverse/.test(this.pushStyle.push['flex-direction'])
      ? (this.$t('input.right') as string)
      : (this.$t('input.left') as string);
    this.logoImage = this.pushStyle.logo;
    this.currentState = this.pushStyle.logo.includes('http') || 'empty';
  }

  changeTemplate(index: number) {
    const template = `${this.templateOptions[index].name}${
      this.selectedImagePosition === this.$t('input.right') && this.templateOptions[index].name !== 'bar' ? 'Right' : ''
    }`;
    this.selectedTemplate = this.templateOptions[index].value.toString();
    this.showTemplate = false;
    this.$emit('changeTemplate', template);
  }

  changePosition(index: number) {
    this.selectedPosition = this.positionOptions[index].value as string;
    this.showPushPosition = false;
    this.$emit('changeProperty', 'push', 'bottom', this.positionOptions[index].name === 'top' ? 1 : '0');
    this.$emit('changeProperty', 'push', 'top', this.positionOptions[index].name === 'top' ? '0' : 1);
  }

  changeImagePosition(index: number) {
    this.selectedImagePosition = this.imagePositions[index].value as string;
    this.showImagePosition = false;
    const templateIndex = this.templateOptions.findIndex((x: any) => this.selectedTemplate === x.value);
    this.changeTemplate(templateIndex);
  }

  changeProperty(element: string, name: string, value: string | number) {
    this.$emit('changeProperty', element, name, value);
  }

  changeText(name: string, value: string | number) {
    this.$emit('changeText', name, value);
  }

  changeBackgroundColor(value: string) {
    this.selectedBackgroundColor = value;
    this.changeProperty('push', 'background', value);
  }

  changeBorderColor(value: string) {
    this.selectedBackgroundColor = value;
    this.changeProperty('push', 'border', value + ' 2px solid');
  }

  changeTextColor(value: string) {
    this.selectedTextColor = value;
    this.changeProperty('textColor', 'color', value);
  }

  changeButtonBackgroundColor(isPermission: boolean, value: string) {
    if (isPermission) {
      this.selectedBackgroundColorPermission = value;
      this.changeProperty('permissionButton', 'background', value);
    } else {
      this.selectedBackgroundColorDeny = value;
      this.changeProperty('denyButton', 'background', value);
    }
  }

  changeButtonTextColor(isPermission: boolean, value: string) {
    if (isPermission) {
      this.selectedTextColorPermission = value;
      this.changeProperty('permissionButton', 'color', value);
    } else {
      this.selectedTextColorDeny = value;
      this.changeProperty('denyButton', 'color', value);
    }
  }

  changeButtonBorderColor(isPermission: boolean, value: string) {
    if (isPermission) {
      this.selectedBorderColorPermission = value;
      this.changeProperty('permissionButton', 'border', value + ' 2px solid');
    } else {
      this.selectedBorderColorDeny = value;
      this.changeProperty('denyButton', 'border', value + ' 2px solid');
    }
  }

  changeTriggerOption(index: number, value: number) {
    this.selectedTrigger = index;
    this.changeScript(this.triggerOptions[index].name, value);
  }

  changeScript(trigger: string, value: number) {
    let script;
    if (trigger === 'access') {
      script = `
          const scriptValue = ${value * 1000};
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          setTimeout(() => {
            if(this.webpush_settings.template === 'native') {
              this.requestPermission();
            } else {
              pushAlert.style.display = "flex";
            }
          }, scriptValue);`;
    }

    if (trigger === 'percentScroll') {
      script = `
          const scriptValue = ${value};
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          window.addEventListener('scroll', ()=> {
            const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

            if (scrollPercent >= scriptValue) {
              if(this.webpush_settings.template === 'native') {
                this.requestPermission();
              } else {
                pushAlert.style.display = "flex";
              }
            }
          });`;
    }

    if (trigger === 'inactive') {
      script = `
          const pushAlert = document.querySelector(".bms-push-alert");
          pushAlert.style.display = "none";
          let inactivityTimeout;

          function resetInactivityTimer() {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = setTimeout(() => {
              if(this.webpush_settings.template === 'native') {
                this.requestPermission();
              } else {
                pushAlert.style.display = "flex";
              }
            }, ${value * 1000});
          }

          window.addEventListener('mousemove', resetInactivityTimer);
          window.addEventListener('keydown', resetInactivityTimer);

          resetInactivityTimer();`;
    }
    this.$emit('changeScript', script, trigger);
  }

  onChangeImage(e: { target: { files: any }; dataTransfer: { files: any } }) {
    const files = e.target.files || e.dataTransfer.files;

    if (!files.length) {
      this.dragging = false;
      return;
    }
    this.createImage(files[0]);
  }

  async createImage(image: File) {
    this.dragging = false;
    if (!image.type.match(/image\/(jpeg|png|svg\+xml)|webp/)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.notImageFile') as string,
      });
      return;
    }
    this.currentState = 'imageUpload';
    this.logoImage = await this.getBase64(image);

    const imageUpload = await this.apiService.genericUpload({
      data: '' + this.logoImage,
      name: image?.name || '',
      pathFolderName: 'bms/push/images',
      isPublic: true,
    });
    this.changeText('logo', imageUpload?.data.link);
  }

  getBase64(file: any) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
    });
  }

  removeImage() {
    this.currentState = 'empty';
    this.logoImage = require('../../../assets/default-logo.png');
    this.changeText('logo', this.logoImage);
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.label-title-small {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

label {
  color: #5c5c5c !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 100%;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
  position: relative;
  border-radius: 0px 0px 8px 8px !important;
}
.select-options {
  border-bottom: 1px solid #f5f5f5;
  align-items: center;
}

.select-template {
  cursor: pointer;
}

.option-template {
  cursor: pointer;
}
.option {
  border-top: 1px solid #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 8px;
  background-color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: #5c5c5c;

  &:hover {
    background: #f5f5f5;
  }
}

.last-item {
  border-radius: 0px 0px 8px 8px !important;
}

.select-button {
  width: 100%;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  border: 1px solid #d9d9d9;
  box-shadow: none;
  overflow: unset !important;
  border-radius: 8px;
}

.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid #f5f5f5;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  width: fit-content;
  border-radius: 0px 0px 8px 8px !important;
}

.menu {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;

  & > p {
    font-size: 12px;
    margin: 0;
    text-transform: none;
    font-weight: normal;
  }

  & > .menu-open {
    color: $ds-blue;
  }
}

.icon-up {
  color: #5c5c5c;
}

input[type='radio'] {
  width: 14px;
  height: 14px;
  background-color: transparent;
  border: #d9d9d9 2px solid;
  border-radius: 50%;
}

input[type='radio']:checked {
  border: $ds-blue 2px solid;
}

.trigger-options {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-direction: row;

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  span {
    font-size: 12px;
  }
}

.radio-circle {
  position: absolute;
  width: 6px;
  height: 6px;
  background-color: $ds-blue;
  border-radius: 50%;
  left: 4px;
}

.choose-option {
  color: $ds-blue;
  font-weight: bold;
}

.input-color {
  z-index: 2;
  position: absolute;
  top: 6px;
  right: 10px;

  &:hover {
    cursor: pointer;
  }
}

.input-style {
  font-weight: 400;
  font-size: 12px;
  border-radius: 8px;
  width: 100%;
  flex: 1;
  padding: 8px 9px;
  border: 1px #d9d9d9 solid;
  outline: none;

  &:focus {
    border: 1px $ds-blue solid;
    outline: none;
  }
}

input[type='color'] {
  appearance: none;
  width: 24px;
  height: 24px;
  border: none;
  outline: none;
  padding: 0;
  border-radius: 8px;
}

input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
  border: none;
}

input[type='color']::-webkit-color-swatch {
  border: 1px #a6a6a6 solid;
  border-radius: 8px;
}

.input-number {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  outline: none;
  font-size: 12px;
  padding-right: 10px;
}

.disable-input {
  cursor: not-allowed !important;
  border-color: #f5f5f5;
  background: #f5f5f5;
  color: #a6a6a6;
}

.input-size {
  height: 40px;
  width: 40px;
}

.button-number {
  height: 15px;
  outline: none;
}

button.button-number:disabled {
  cursor: not-allowed;
  background-color: inherit !important;
}

input[type='number'] {
  -moz-appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.div-first-item {
  padding-top: 16px;
}

.div-more-items {
  display: flex;
  width: 100%;
  gap: 8px;
}

.div-last-item {
  border-bottom: 1px #eaeaea solid;
  padding-bottom: 16px;
}

.box-div {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 33%;
  height: 36px;
  padding: 2px 0px;
  border: 1px #d9d9d9 solid;
  border-radius: 8px;

  &:hover {
    cursor: pointer;
    background: #d9d9d9;
  }
}

.box-active {
  border-color: $ds-blue;
  background: $ds-blue-100;
  .border-item {
    border-color: $ds-blue;
  }

  &:hover {
    background: $ds-blue-100;
  }
}

.border-item {
  width: 24px;
  height: 24px;
  border: 1px #5c5c5c solid;
}

.border-radius {
  border-radius: 8px;
}

.border-circle {
  border-radius: 50%;
}

.image-area {
  background: #f5f5f5;
  padding: 10px 16px;
  border-radius: 8px;
}

.dropZone {
  height: 180px;
  padding: 15px 5px;
  justify-content: center;
  display: flex;
  align-items: center;
  flex-direction: column;
  outline: 1px dashed #a6a6a6;
  border-radius: 8px;
  transition: margin 0.15s ease-in-out, height 0.15s ease-in-out, background-color 0.15s linear;
}

.drop-actions {
  position: relative;
  width: 100%;
  margin-bottom: 10px;
}

.dropZone-over {
  margin: 10px;
  height: 170px;
  padding: 10px 0px;
  background-color: #f4f8ff;
  border-radius: 8px;
}

.dropZone input {
  cursor: pointer !important;
  top: 0px;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  position: absolute;
}

.dash-blue:hover .dropZone-title {
  color: #a6a6a6;
}

.dropZone-title {
  color: $ds-blue;
  font-size: 12px;
  text-align: center;
}

.dropZone-title-drag {
  color: #5c5c5c;
  font-weight: 700;
  font-size: 12px;
  line-height: 1em;
}

.dropZone-title ~ .dropZone-title-drag ~ .file-drag:hover {
  text-decoration: none !important;
}

.div-show-image {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
}

.div-image {
  border: 1px dashed #a6a6a6;
  padding: 20px 20px;
  border-radius: 8px;
}

::v-deep.v-card.push-desktop-format {
  box-shadow: none !important;
}

.push-desktop-format {
  height: 417px !important;
}
</style>
