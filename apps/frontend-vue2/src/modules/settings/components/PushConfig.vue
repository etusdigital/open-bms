<template>
  <div>
    <div>
      <label class="label-title pb-0 font-16">{{ $t('title.utmParams') }}</label>
      <v-card class="background-card message-form mt-0">
        <div class="div-input-params">
          <InputDefault
            name="Source"
            data-cy="source"
            :modelValue="webpush_settings.utmSource"
            :placeholder="$t('input.typeHere')"
          />
          <InputDefault
            name="Medium"
            data-cy="medium"
            :modelValue="webpush_settings.utmMedium"
            :placeholder="$t('input.typeHere')"
          />
          <InputDefault
            :name="$t('input.name')"
            data-cy="name"
            :modelValue="webpush_settings.utmName"
            :placeholder="$t('input.typeHere')"
          />
        </div>
      </v-card>
    </div>
    <div>
      <label class="label-title pb-0 font-16">{{ $t('title.integration') }} - Push Notification</label>
      <v-card class="background-card message-form mt-0">
        <div>
          <span class="font-12">{{ $t('datatable.toSetPush') }}</span>
          <ol>
            <li class="config-span font-12">{{ $t('datatable.downloadFile') }}</li>
            <ButtonDefault class="font-10" name="Download sw.js" @click="handleDownloadSw()" />
            <div class="d-flex justify-space-between">
              <li class="config-span font-12">{{ $t('create.integrationTutorial') }}</li>
              <button class="copy-button font-10 mb-4" @click="handleCopy()">{{ $t('button.copy') }}</button>
            </div>
            <div class="textarea-wrapper">
              <textarea class="script-code" @click="handleCopy()" id="code-textarea" v-model="pushScript" readonly>
              </textarea>
            </div>
          </ol>
        </div>
      </v-card>
    </div>
    <label class="label-title pb-0 font-16">{{ $t('title.popUp') }}</label>
    <div class="div-formatting">
      <div v-if="templateDeviceOptions === 0 || webpush_settings.isMobileSameTemplate" class="preview-push">
        <img src="@/assets/background-push-preview.png" />
        <div v-if="webpush_settings.template !== 'native'" v-html="formattedHtmlPreview()"></div>
        <div class="div-column p-3 native-push" v-else>
          <img class="native-push-img" src="@/assets/native-push.png" alt="" />
          <label class="font-14 text-400 align-self-center mb-0 mt-2">{{ $t('input.nativePreview') }}</label>
        </div>
      </div>
      <div v-if="templateDeviceOptions === 1 && !webpush_settings.isMobileSameTemplate" class="preview-mobile">
        <div class="phone-frame div-column justify-space-between">
          <img src="@/assets/phone-speaker.svg" class="phone-speaker mb-2" />
          <div class="preview-mobile-inside align-items-center">
            <div class="d-flex" v-html="formattedHtmlMobilePreview()"></div>
            <img class="pt-4 pl-6" src="@/assets/mobile-background.svg" />
          </div>
          <img src="@/assets/phone-button.svg" class="phone-button" />
        </div>
      </div>
      <v-card class="format-push">
        <div class="div-row gap-10 justify-content-center mb-2 mt-2">
          <button
            v-for="(value, index) in navBarValues"
            :key="`menuPushDevice${index}`"
            class="config-button font-14 text-600"
            :class="index === templateDeviceOptions ? 'config-button-active' : ''"
            @click="changeNavBarOption(index)"
          >
            {{ value }}
          </button>
        </div>
        <div class="format-push-inside pb-2">
          <PushFormatting
            v-if="templateDeviceOptions === 0"
            :scriptType="webpush_settings.scriptType"
            :pushScriptValue="webpush_settings.scriptShowPush"
            :pushStyle="pushStyle"
            :pushSettings="webpush_settings"
            @changeTemplate="changeTemplate"
            @changeProperty="changeProperty"
            @changeText="changeText"
            @changeScript="changeScript"
            @changeNavBarOption="changeNavBarOption"
          />
          <PushMobileFormatting
            v-if="templateDeviceOptions === 1"
            :scriptMobileType="webpush_settings.mobileScriptType"
            :pushMobileScriptValue="webpush_settings.mobileScriptShowPush"
            :pushMobileStyle="pushMobileStyle"
            :isMobileSameTemplate="webpush_settings.isMobileSameTemplate"
            @changeProperty="changeProperty"
            @changeText="changeText"
            @changeScript="changeScript"
            @changeNavBarOption="changeNavBarOption"
            @isMobileSameTemplate="changeisMobileSameTemplate"
          />
        </div>
      </v-card>
    </div>
    <v-card class="mt-4 p-3 background-card div-column card-specs">
      <label class="text-600 ds-gray-color font-12" for="">{{ $t('input.viewIn') }}</label>
      <div
        v-for="(urlIn, indexShow) in webpush_settings.urlFilterShow"
        :key="'show_' + indexShow"
        class="div-row gap-10 pb-3"
      >
        <div class="url-text div-row">
          <label for="youridhere" class="static-value">{{ `${accountUrl}/` }}</label>
          <input
            type="text"
            :placeholder="`${$t('input.insertUrl')}`"
            :value="urlIn"
            id="youridhere"
            class="url-input"
            @input="changeUrl(indexShow, $event.target.value, 'urlShow')"
          />
        </div>
        <button
          class="button-trash"
          @click="removeUrl(indexShow, 'urlShow')"
          type="button"
          style="z-index: 10"
          v-if="webpush_settings.urlFilterShow.length > 1"
        >
          <span class="material-symbols-rounded ds-light-gray-color">delete</span>
        </button>
      </div>
      <button class="add-url d-flex align-items-center text-600 font-12" @click="addUrl('urlShow')">
        <span class="material-symbols-rounded"> add </span>
        {{ $t('button.addUrl') }}
      </button>
      <label class="text-600 mt-4 ds-gray-color font-12" for="">{{ $t('input.notViewIn') }}</label>
      <div
        v-for="(urlHide, indexHide) in webpush_settings.urlFilterHide"
        :key="'hide_' + indexHide"
        class="div-row gap-10 pb-3"
      >
        <div class="url-text div-row">
          <label for="youridhere" class="static-value">{{ `${accountUrl}/` }}</label>
          <input
            type="text"
            :placeholder="`${$t('input.insertUrl')}`"
            :value="urlHide"
            id="youridhere"
            class="url-input"
            @input="changeUrl(indexHide, $event.target.value, 'urlHide')"
          />
        </div>
        <button class="button-trash" @click="removeUrl(indexHide, 'urlHide')" type="button" style="z-index: 10">
          <span class="material-symbols-rounded ds-light-gray-color">delete</span>
        </button>
      </div>
      <button class="add-url mb-2 d-flex align-items-center text-600 font-12" @click="addUrl('urlHide')">
        <span class="material-symbols-rounded"> add </span>
        {{ $t('button.addUrl') }}
      </button>
      <label class="font-10">{{ $t('input.urlTips') }}</label>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '../../../components/button/ButtonDefault.vue';
import InputDefault from '../../../components/input/InputDefault.vue';
import AddStepButtonComponent from '@/components/add-step-button/AddStepButtonComponent.vue';
import PushFormatting from './PushFormatting.vue';
import PushMobileFormatting from './PushMobileFormatting.vue';
import { PushTemplates } from '../dtos/pushTemplates.dto';

@Component({
  components: { ButtonDefault, InputDefault, AddStepButtonComponent, PushFormatting, PushMobileFormatting },
  props: ['pushScript', 'accountUrl', 'pushConfigs'],
})
export default class PushConfig extends Vue {
  @Prop() pushScript!: any;
  @Prop() accountUrl!: any;
  @Prop() pushConfigs!: any;

  pushStyle: any = {};
  pushMobileStyle: any = {};
  webpush_settings: any = {};
  lastUrlIndex = 0;
  lastUrlIndexHide = 0;
  templateDeviceOptions = 0;
  urlFilterShow = ['*'];
  urlFilterHide = [];

  displayOptions = [
    { name: 'allPages', value: this.$t('input.allPages') },
    { name: 'showOn', value: this.$t('input.showOn') },
    { name: 'notShowOn', value: this.$t('input.notShowOn') },
  ];

  pushTemplates: any = {
    default: {
      push: {
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-end',
        width: 'fit-content',
        'box-shadow': ' 0px 1px 3px #0000001a',
      },
      divTitle: {
        'flex-direction': 'row',
      },
      logoStyle: {
        'margin-right': '16px',
        'margin-left': '0px',
      },
      subTitleStyle: {
        'margin-bottom': '24px !important',
      },
      divButtonStyle: {
        'flex-direction': 'row',
      },
    },
    defaultRight: {
      push: {
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-end',
        width: 'fit-content',
      },
      divTitle: {
        'flex-direction': 'row-reverse',
        'align-items': 'flex-start',
      },
      logoStyle: {
        'margin-right': '0px',
        'margin-left': '16px',
      },
      subTitleStyle: {
        'margin-bottom': '24px !important',
      },
      divButtonStyle: {
        'flex-direction': 'row',
      },
    },
    bar: {
      push: {
        'flex-direction': 'row',
        'justify-content': 'space-between',
        'align-items': 'center',
        width: '95%',
      },
      divTitle: {
        'flex-direction': 'row',
        'align-items': 'center',
      },
      logoStyle: {
        'margin-right': '16px',
        'margin-left': '0px',
      },
      subTitleStyle: {
        'margin-bottom': '0px !important',
      },
      divButtonStyle: {
        'flex-direction': 'row',
      },
    },
    native: {
      push: {
        'flex-direction': 'row',
        'justify-content': 'space-between',
        'align-items': 'center',
        width: '95%',
      },
    },
  };
  navBarValues = ['Desktop', 'Mobile'];

  beforeMount() {
    this.pushStyle = this.pushConfigs?.pushStyle || {
      logo: require('../../../assets/default-logo.png'),
      push: {
        position: 'fixed',
        display: 'flex',
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-end',
        width: 'fit-content',
        top: '0',
        right: '50%',
        padding: '20px',
        background: '#ffffff',
        'border-radius': '0px',
        border: 'none',
        transform: 'translate(50%replaceForComma 0)',
        'z-index': 999999999,
        'box-shadow': ' 0px 1px 3px #0000001a',
      },
      divTitle: {
        display: 'flex',
        'align-items': 'flex-start',
        'flex-direction': 'row',
      },
      divText: {
        'text-align': 'start',
      },
      logoStyle: {
        display: 'block',
        width: '64px',
        height: '64px',
        'margin-right': '16px',
        'margin-left': '0px',
      },
      title: 'Título do opt-in',
      titleStyle: {
        'font-size': '16px',
        'line-height': '130%',
        'font-weight': 'bold',
        'margin-bottom': '8px !important',
      },
      subTitle: 'Lorem ipsum dolor sit amet consectetur. Nunc nibh ut purus diam. Ultrices erat enim massa.',
      subTitleStyle: {
        'font-size': '14px',
        'line-height': '130%',
        'margin-bottom': '24px !important',
      },
      textColor: {
        color: '#000000',
      },
      divButtonStyle: {
        display: 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-end',
        height: 'fit-content',
        gap: '8px',
      },
      buttonStyle: {
        padding: '10px 20px',
        cursor: 'pointer',
      },
      permissionButton: {
        'border-radius': '0px',
        background: '#0FB75C',
        color: '#ffffff',
        border: 'none',
      },
      permissionButtonText: 'Permitir',
      denyButton: {
        'border-radius': '0px',
        background: '#EAEAEA',
        color: '#A6A6A6',
        border: 'none',
      },
      denyButtonText: 'Não',
    };

    this.pushMobileStyle = this.pushConfigs?.pushMobileStyle || {
      logo: require('../../../assets/default-logo.png'),
      push: {
        position: 'fixed',
        display: 'flex',
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        width: '100%',
        padding: '20px',
        background: '#ffffff',
        'border-radius': '0px',
        border: 'none',
        top: '0px',
        'z-index': 999999999,
        'box-shadow': ' 0px 1px 3px #0000001a',
      },
      divTitle: {
        display: 'flex',
        'align-items': 'flex-start',
        'flex-direction': 'row',
      },
      divText: {
        'text-align': 'start',
      },
      logoStyle: {
        display: 'block',
        width: '64px',
        height: '64px',
        'margin-right': '16px',
        'margin-left': '0px',
      },
      title: 'Título do opt-in',
      titleStyle: {
        'font-size': '16px',
        'line-height': '130%',
        'font-weight': 'bold',
        'margin-bottom': '8px !important',
      },
      subTitle: 'Lorem ipsum dolor sit amet consectetur. Nunc nibh ut purus diam. Ultrices erat enim massa.',
      subTitleStyle: {
        'font-size': '14px',
        'line-height': '130%',
        'margin-bottom': '24px !important',
      },
      textColor: {
        color: '#000000',
      },
      divButtonStyle: {
        display: 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-end',
        'align-self': 'flex-end',
        height: 'fit-content',
        gap: '8px',
      },
      buttonStyle: {
        padding: '10px 20px',
        cursor: 'pointer',
      },
      permissionButton: {
        'border-radius': '0px',
        background: '#0FB75C',
        color: '#ffffff',
        border: 'none',
      },
      permissionButtonText: 'Permitir',
      denyButton: {
        'border-radius': '0px',
        background: '#EAEAEA',
        color: '#A6A6A6',
        border: 'none',
      },
      denyButtonText: 'Não',
    };

    this.webpush_settings =
      Object.keys(this.pushConfigs).length > 1
        ? this.pushConfigs
        : {
            isActive: true,
            template: 'default',
            utmSource: '',
            utmMedium: '',
            utmName: '',
            scriptShowPush: '',
            scriptType: 'access',
            pushStyle: this.pushStyle,
            urls: [this.accountUrl ? this.accountUrl : ''],
            urlFilterShow: this.urlFilterShow,
            urlFilterHide: this.urlFilterHide,
            isMobileSameTemplate: true,
            scriptToRun: '',

            mobileTemplate: 'default',
            mobileScriptType: 'access',
            mobileScriptShowPush: '',
            pushMobileStyle: this.pushMobileStyle,
            // prettier-ignore
            html: `
            <div style="${this.transformIntoStyle(this.pushStyle.push)}" class="bms-push-alert">
              <div style="${this.transformIntoStyle(this.pushStyle.divTitle)}">
                <img src="${this.pushStyle.logo}" style="${this.transformIntoStyle(this.pushStyle.logoStyle)}">
                <div style="${this.transformIntoStyle(this.pushStyle.divText)}">
                  <h5 style="${this.transformIntoStyle(this.pushStyle.textColor)} ${this.transformIntoStyle(this.pushStyle.titleStyle)}">${this.pushStyle.title}</h5>
                  <p style="${this.transformIntoStyle(this.pushStyle.textColor)} ${this.transformIntoStyle(this.pushStyle.subTitleStyle)}">${this.pushStyle.subTitle}</p>
                </div>
              </div>
              <div style="${this.transformIntoStyle(this.pushStyle.divButtonStyle)}">
                <button class="bms-deny-button" style="${this.transformIntoStyle(this.pushStyle.buttonStyle)} ${this.transformIntoStyle(this.pushStyle.permissionButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
                  ${this.pushStyle.permissionButtonText}
                </button>
                <button class="bms-permission-button" style="${this.transformIntoStyle(this.pushStyle.buttonStyle)} ${this.transformIntoStyle(this.pushStyle.denyButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
                  ${this.pushStyle.denyButtonText}
                </button>
              </div>
            </div>
          `,
            // prettier-ignore
            mobileHtml: `
            <div style="${this.transformIntoStyle(this.pushMobileStyle.push)}" class="bms-push-alert">
              <div style="${this.transformIntoStyle(this.pushMobileStyle.divTitle)}">
                <img src="${this.pushMobileStyle.logo}" style="${this.transformIntoStyle(this.pushMobileStyle.logoStyle)}">
                <div style="${this.transformIntoStyle(this.pushMobileStyle.divText)}">
                  <h5 style="${this.transformIntoStyle(this.pushMobileStyle.textColor)} ${this.transformIntoStyle(this.pushMobileStyle.titleStyle)}">${this.pushMobileStyle.title}</h5>
                  <p style="${this.transformIntoStyle(this.pushMobileStyle.textColor)} ${this.transformIntoStyle(this.pushMobileStyle.subTitleStyle)}">${this.pushMobileStyle.subTitle}</p>
                </div>
              </div>
              <div style="${this.transformIntoStyle(this.pushMobileStyle.divButtonStyle)}">
                <button class="bms-deny-button" style="${this.transformIntoStyle(this.pushMobileStyle.buttonStyle)} ${this.transformIntoStyle(this.pushMobileStyle.permissionButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
                  ${this.pushMobileStyle.permissionButtonText}
                </button>
                <button class="bms-permission-button" style="${this.transformIntoStyle(this.pushMobileStyle.buttonStyle)} ${this.transformIntoStyle(this.pushMobileStyle.denyButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">\
                  ${this.pushMobileStyle.denyButtonText}
                </button>
              </div>
            </div>
          `,
          };

    if (!Object.keys(this.pushConfigs).length) {
      this.updatePushConfigs(this.webpush_settings);
    }
  }

  handleCopy() {
    this.$emit('handleCopy');
  }

  handleDownloadSw() {
    this.$emit('handleDownloadSw');
  }

  changeUrl(index: number, value: string, urlType: string) {
    const formatedUrl = value.replace(this.accountUrl + '/', '');
    if (urlType === 'urlShow') {
      this.webpush_settings.urlFilterShow[index] = formatedUrl;
      this.webpush_settings.urlFilterShow.push();
    }
    if (urlType === 'urlHide') {
      this.webpush_settings.urlFilterHide[index] = formatedUrl;
      this.webpush_settings.urlFilterHide.push();
    }
  }

  addUrl(urlType: string) {
    if (urlType === 'urlShow') {
      this.webpush_settings.urlFilterShow.push('');
      this.lastUrlIndex++;
    }
    if (urlType === 'urlHide') {
      this.webpush_settings.urlFilterHide.push('');
      this.lastUrlIndexHide++;
    }
  }

  removeUrl(index: number, urlType: string) {
    if (urlType === 'urlShow') {
      this.webpush_settings.urlFilterShow.splice(index, 1);
      this.lastUrlIndex--;
    }
    if (urlType === 'urlHide') {
      this.webpush_settings.urlFilterHide.splice(index, 1);
      this.lastUrlIndexHide--;
    }
  }

  transformIntoStyle(obj: any) {
    if (obj) {
      return (
        JSON.stringify(obj)
          .replaceAll('{', '')
          .replaceAll('}', '')
          .replaceAll('"', '')
          .replaceAll(',', ';')
          .replaceAll('replaceForComma', ',') + ';'
      );
    }
  }

  changeTemplate(template: keyof PushTemplates) {
    const self = this;
    Object.keys(this.pushTemplates[template]).forEach((style: any) => {
      Object.keys(this.pushTemplates[template][style as keyof typeof self.pushTemplates]).forEach((format: any) => {
        this.pushStyle[style as keyof typeof self.pushStyle][format as keyof typeof self.pushStyle] =
          this.pushTemplates[template][style as keyof typeof self.pushTemplates][
            format as keyof typeof self.pushTemplates
          ];
      });
    });
    this.webpush_settings.template = template.replace('Right', '');
  }

  changeProperty(element: string, name: string, value: string | number) {
    if (this.templateDeviceOptions === 0) {
      const self = this;
      this.pushStyle[element as keyof typeof self.pushStyle][name as keyof typeof self.pushStyle] = value;
    }
    if (this.templateDeviceOptions === 1) {
      const self = this;
      this.pushMobileStyle[element as keyof typeof self.pushMobileStyle][name as keyof typeof self.pushMobileStyle] =
        value;
    }
  }

  changeText(name: any, value: string | number) {
    const self = this;
    if (this.templateDeviceOptions === 0) {
      this.pushStyle[name as keyof typeof self.pushStyle] = value;
    }
    if (this.templateDeviceOptions === 1) {
      this.pushMobileStyle[name as keyof typeof self.pushMobileStyle] = value;
    }
  }

  changeScript(script: string, scriptType: string) {
    if (this.templateDeviceOptions === 0) {
      this.webpush_settings.scriptType = scriptType;
      this.webpush_settings.scriptShowPush = script;
    }
    if (this.templateDeviceOptions === 1) {
      this.webpush_settings.mobileScriptType = scriptType;
      this.webpush_settings.mobileScriptShowPush = script;
    }

    this.webpush_settings.scriptToRun = this.getFinalScript();
  }

  getFinalScript() {
    return `
      const bmsIsMobileSameTemplate = ${this.webpush_settings.isMobileSameTemplate};
      const bmsIsMobile = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune|Windows Phone/i.test(navigator.userAgent);
      const urlFilterShow = ${JSON.stringify(this.webpush_settings.urlFilterShow)};
      const urlFilterHide = ${JSON.stringify(this.webpush_settings.urlFilterHide)};
      function shouldLoadBmsPush(filter) {
        let urlObject = new URL(location.href);
        let pathAndQuery = (urlObject.pathname + urlObject.search).toLowerCase();
        const hasStartingWildcard = filter.startsWith('*');
        const hasEndingWildcard = filter.endsWith('*');
        let processedFilter = filter.replaceAll('*', '').toLowerCase();

        if (pathAndQuery.startsWith('/')) {
          pathAndQuery = pathAndQuery.slice(1);
        }

        if (hasStartingWildcard && hasEndingWildcard) {
          return pathAndQuery.includes(processedFilter);
        } else if (hasStartingWildcard) {
          return pathAndQuery.endsWith(processedFilter);
        } else if (hasEndingWildcard) {
          return pathAndQuery.startsWith(processedFilter);
        } else {
          return pathAndQuery === processedFilter;
        }
      }

      if (urlFilterShow.some((filter) => shouldLoadBmsPush(filter)) && urlFilterHide.some((filter) => shouldLoadBmsPush(filter)) === false) {
        if (!bmsIsMobile || bmsIsMobile && bmsIsMobileSameTemplate) {
          ${this.webpush_settings.scriptShowPush}
        } else if (bmsIsMobile && !bmsIsMobileSameTemplate) {
          ${this.webpush_settings.mobileScriptShowPush}
        }
      } else {
        const pushAlert = document.querySelector(".bms-push-alert");
        pushAlert.style.display = "none";
      }
    `;
  }

  updatePushConfigs(newPushConfigs: any) {
    this.$emit('updatePushConfigs', newPushConfigs);
  }

  formattedHtmlPreview() {
    return this.webpush_settings.html.replace('style="position:fixed;', 'style="position:absolute;');
  }

  formattedHtmlMobilePreview() {
    return this.webpush_settings.mobileHtml.replace('style="position:fixed;', 'style="position:absolute;');
  }

  @Watch('pushStyle', { immediate: true, deep: true })
  changePush() {
    this.webpush_settings.pushStyle = this.pushStyle;
    // prettier-ignore
    this.webpush_settings.html = `
      <div style="${this.transformIntoStyle(this.pushStyle.push)}" class="bms-push-alert">
        <div style="${this.transformIntoStyle(this.pushStyle.divTitle)}">
          <img src="${this.pushStyle.logo}" style="${this.transformIntoStyle(this.pushStyle.logoStyle)}">
          <div style="${this.transformIntoStyle(this.pushStyle.divText)}">
            <h5 style="${this.transformIntoStyle(this.pushStyle.textColor)} ${this.transformIntoStyle(this.pushStyle.titleStyle)}">${this.pushStyle.title}</h5>
            <p style="${this.transformIntoStyle(this.pushStyle.textColor)} ${this.transformIntoStyle(this.pushStyle.subTitleStyle)}">${this.pushStyle.subTitle}</p>
          </div>
        </div>
        <div style="${this.transformIntoStyle(this.pushStyle.divButtonStyle)}">
          <button class="bms-deny-button" style="${this.transformIntoStyle(this.pushStyle.buttonStyle)} ${this.transformIntoStyle(this.pushStyle.denyButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${this.pushStyle.denyButtonText}
          </button>
          <button class="bms-permission-button" style="${this.transformIntoStyle(this.pushStyle.buttonStyle)} ${this.transformIntoStyle(this.pushStyle.permissionButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${this.pushStyle.permissionButtonText}
          </button>
        </div>
      </div>
    `;
    this.updatePushConfigs(this.webpush_settings);
  }

  @Watch('pushMobileStyle', { immediate: true, deep: true })
  changeMobile() {
    this.webpush_settings.pushMobileStyle = this.pushMobileStyle;
    // prettier-ignore
    this.webpush_settings.mobileHtml = `
      <div style="${this.transformIntoStyle(this.pushMobileStyle.push)}" class="bms-push-alert">
        <div style="${this.transformIntoStyle(this.pushMobileStyle.divTitle)}">
          <img src="${this.pushMobileStyle.logo}" style="${this.transformIntoStyle(this.pushMobileStyle.logoStyle)}">
          <div style="${this.transformIntoStyle(this.pushMobileStyle.divText)}">
            <h5 style="${this.transformIntoStyle(this.pushMobileStyle.textColor)} ${this.transformIntoStyle(this.pushMobileStyle.titleStyle)}">${this.pushMobileStyle.title}</h5>
            <p style="${this.transformIntoStyle(this.pushMobileStyle.textColor)} ${this.transformIntoStyle(this.pushMobileStyle.subTitleStyle)}">${this.pushMobileStyle.subTitle}</p>
          </div>
        </div>
        <div style="${this.transformIntoStyle(this.pushMobileStyle.divButtonStyle)}">
          <button class="bms-deny-button" style="${this.transformIntoStyle(this.pushMobileStyle.buttonStyle)} ${this.transformIntoStyle(this.pushMobileStyle.denyButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${this.pushMobileStyle.denyButtonText}
          </button>
          <button class="bms-permission-button" style="${this.transformIntoStyle(this.pushMobileStyle.buttonStyle)} ${this.transformIntoStyle(this.pushMobileStyle.permissionButton)}" onMouseOver="this.style.opacity=0.8" onMouseOut="this.style.opacity=1">
            ${this.pushMobileStyle.permissionButtonText}
          </button>
        </div>
      </div>
    `;
    this.updatePushConfigs(this.webpush_settings);
  }

  changeisMobileSameTemplate(template: boolean) {
    this.webpush_settings.isMobileSameTemplate = template;
    this.webpush_settings.scriptToRun = this.getFinalScript();
    this.updatePushConfigs(this.webpush_settings);
  }

  changeNavBarOption(index: number) {
    this.templateDeviceOptions = index;
  }

  @Watch('webpush_settings.urlFilterShow')
  @Watch('webpush_settings.urlFilterHide')
  showHideUrl() {
    this.webpush_settings.scriptToRun = this.getFinalScript();
    this.updatePushConfigs(this.webpush_settings);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep.v-card {
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06) !important;
}

.message-form {
  padding: 20px;
}

.div-input-params {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.config-span {
  margin-top: 20px;
  margin-bottom: 10px;
}
.copy-button {
  border: 2px $ds-blue solid;
  border-radius: 8px;
  padding: 0px 12px;
  color: $ds-blue;
  font-weight: bold;
  text-transform: uppercase;
  height: 36px;
  font-size: 14px;
  margin-right: 24px;
  margin-top: 10px;

  &:hover {
    background: $ds-blue;
    color: white;
  }
}

.script-code {
  height: 350px;
  width: 98.5%;
  cursor: pointer;
  background-color: #f5f5f5;
  border-radius: 16px;
  resize: none;

  &:focus-visible {
    border: #5c5c5c 1px solid !important;
  }
}

.div-formatting {
  display: flex;
  flex-direction: row;
  width: 100%;
  gap: 16px;
}

.preview-push {
  position: relative;
  background: #eaeaea;
  width: 80%;
  height: 492px;
  padding: 54px 24px;
  border-radius: 16px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);

  img {
    height: 100%;
    width: 100%;
  }
}

.label-title-small {
  font-size: 14px;
  font-weight: bold;
}

.display-options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 2px;

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  span {
    font-size: 14px;
  }
}

input[type='radio'] {
  width: 18px;
  height: 18px;
  -webkit-appearance: none;
  background-color: transparent;
  border: #d9d9d9 2px solid;
  border-radius: 50%;
}

input[type='radio']:checked {
  border: $ds-blue 2px solid;
}

.radio-circle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: $ds-blue;
  border-radius: 50%;
  left: 4px;
}

.choose-option {
  color: $ds-blue;
  font-weight: bold;
}

.div-url {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.not-last-url {
  margin-right: 36px;
  margin-bottom: 8px;
}

.add-button {
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 28px !important;
  width: 28px !important;
  margin-bottom: 6px;
  background-color: #0fb75c;
  border-radius: 18px;
}
.add {
  color: white !important;
}
.preview-mobile {
  border-radius: 16px;
  background: var(--cinzas-gray-200, #eaeaea);
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  position: relative;
  display: flex;
  width: 80%;
  height: 800px;
  align-items: center;
  place-content: center;
  padding-top: 20px;
  padding-bottom: 20px;
}

.preview-mobile-inside {
  position: relative;
  background: #e5e5e5;
  height: 90%;
  width: 90%;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.phone-frame {
  width: 403px;
  height: 761px;
  border-radius: 40px;
  background: var(--cinzas-gray-500, #5c5c5c);
  padding-top: 26px;
  padding-bottom: 16px;
  align-items: center;
}

.phone-button {
  width: 33px;
  height: 33px;
  fill: var(--cinzas-gray-400, linear-gradient(0deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), #a6a6a6);
}

.phone-speaker {
  width: 80px;
  height: 8px;
  fill: var(--cinzas-gray-400, linear-gradient(0deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), #a6a6a6);
}

.format-push {
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06) !important;
  position: relative;
  height: 100%;
  padding: 10px 5px 0px 0px;
  border-radius: 16px;
  width: 20%;
  overflow-y: auto;

  &::-webkit-scrollbar-button {
    height: 5%;
  }
}

.format-push-inside {
  padding: 10px 15px 20px 20px;
  height: 100%;
  width: 100%;
}

.config-button {
  color: #a6a6a6;
  border-radius: 12px;
  padding: 5px 12px;

  &:hover {
    background: #f5f5f5;
  }
}

.config-button-active {
  color: $ds-blue;
  background: $ds-blue-100;

  &:hover {
    background: $ds-blue-100;
  }
}

.native-push {
  background-color: #ffffff;
  display: flex;
  top: 22px;
  position: absolute;
  left: 35%;
  border-radius: 8px;
}

.native-push-img {
  height: auto !important;
  width: auto !important;
}
.add-url {
  border-radius: 24px;
  background-color: #0fb75c;
  text-transform: uppercase;
  color: #ffffff;
  width: fit-content;
  padding: 4px 6px;
  align-items: center;
  outline: none;
}

.card-specs {
  height: fit-content;
}

.url-text {
  height: 36px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  padding: 8px 12px 8px 12px;
  font-size: 12px;
  width: -webkit-fill-available;
}

.static-value {
  color: #d9d9d9;
}

.url-input {
  outline: none;
  width: -webkit-fill-available;
}

::placeholder {
  color: #d9d9d9;
}
</style>
