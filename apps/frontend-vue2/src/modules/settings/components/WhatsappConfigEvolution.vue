<template>
  <div>
    <div class="mb-4">
      <div class="font-14 text-600">Verified Name: {{ verifiedNameData }}</div>
      <div class="font-14 text-600">Phone Number: {{ phoneNumberData }}</div>
    </div>
    <div>
      <ButtonDefault
        v-if="!phoneNumberData && !verifiedNameData"
        class="font-10 btn-connect"
        :class="loading ? 'disabled' : ''"
        :name="loading ? `${$t('button.connecting')}...` : `${$t('button.connect')}`"
        @click="loading ? null : handleConnect()"
      />
    </div>
    <div v-if="numberIdData && businessIdData && accessTokenData && phoneNumberData && verifiedNameData">
      <ButtonDefault class="font-10 btn-disconnect" :name="`${$t('button.disconnect')}`" @click="handleDisconnect()" />
    </div>
  </div>
</template>

<script lang="ts">
import axios from 'axios';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '../../../components/button/ButtonDefault.vue';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    fbq: any;
  }
}

@Component({
  components: { ButtonDefault },
})
export default class WhatsappConfigEvolution extends Vue {
  @Prop() numberId!: string;
  @Prop() businessId!: string;
  @Prop() accessToken!: string;
  @Prop() phoneNumber!: string;
  @Prop() verifiedName!: string;

  numberIdData = '';
  businessIdData = '';
  accessTokenData = '';
  phoneNumberData = '';
  verifiedNameData = '';

  loading = false;

  appId = process.env.VUE_APP_FB_APP_ID;
  configId = process.env.VUE_APP_FB_CONFIG_ID;
  token = process.env.VUE_APP_FB_USER_TOKEN;

  mounted() {
    this.initializeData();
    const script = document.createElement('script');
    const src = 'https://connect.facebook.net/en_US/sdk.js';

    script.src = src;
    script.async = true;

    document.body.appendChild(script);

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: this.appId,
        cookie: true,
        xfbml: true,
        version: 'v20.0',
      });
    };

    ((d, s, id) => {
      let js: HTMLScriptElement | null = d.getElementById(id) as HTMLScriptElement;
      const fjs = d.getElementsByTagName(s)[0] as HTMLElement;
      if (js) {
        return;
      }
      js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      if (fjs.parentNode) {
        fjs.parentNode.insertBefore(js, fjs);
      }
    })(document, 'script', 'facebook-jssdk');

    window.addEventListener('message', this.sessionInfoListener);
  }

  beforeDestroy() {
    window.removeEventListener('message', this.sessionInfoListener);
  }

  @Watch('numberId')
  onNumberIdChange(newVal: string) {
    this.numberIdData = newVal;
  }

  @Watch('businessId')
  onBusinessIdChange(newVal: string) {
    this.businessIdData = newVal;
  }

  @Watch('accessToken')
  onAccessTokenChange(newVal: string) {
    this.accessTokenData = newVal;
  }

  @Watch('phoneNumber')
  onPhoneNumberChange(newVal: string) {
    this.phoneNumberData = newVal;
  }

  @Watch('verifiedName')
  onVerifiedNameChange(newVal: string) {
    this.verifiedNameData = newVal;
  }

  initializeData() {
    this.numberIdData = this.numberId;
    this.businessIdData = this.businessId;
    this.accessTokenData = this.accessToken;
    this.phoneNumberData = this.phoneNumber;
    this.verifiedNameData = this.verifiedName;
  }

  async sessionInfoListener(event: MessageEvent) {
    if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
      return;
    }

    try {
      const data = JSON.parse(event.data);
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          const { phone_number_id, waba_id } = data.data;
          this.numberIdData = phone_number_id;
          this.businessIdData = waba_id;
          this.accessTokenData = this.token as string;
          await this.registerWaba();

          const response = await axios.get(`https://graph.facebook.com/v20.0/${this.numberIdData}`, {
            headers: {
              Authorization: `Bearer ${this.accessTokenData}`,
            },
          });

          this.phoneNumberData = response?.data?.display_phone_number;
          this.verifiedNameData = response?.data?.verified_name;
          this.loading = false;

          this.emitUpdates();
        }
      }
    } catch {
      // console.log("Non JSON Response", event.data);
    }
  }

  handleConnect() {
    this.launchWhatsAppSignup();
  }

  handleDisconnect() {
    this.numberIdData = '';
    this.businessIdData = '';
    this.accessTokenData = '';
    this.phoneNumberData = '';
    this.verifiedNameData = '';
    this.loading = false;

    this.emitUpdates();
  }

  emitUpdates() {
    this.$emit('update:numberId', this.numberIdData);
    this.$emit('update:businessId', this.businessIdData);
    this.$emit('update:accessToken', this.accessTokenData);
    this.$emit('update:phoneNumber', this.phoneNumberData);
    this.$emit('update:verifiedName', this.verifiedNameData);
  }

  async registerWaba() {
    if (!this.numberIdData || !this.businessIdData || !this.accessTokenData) {
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${this.numberIdData}/register`,
        {
          messaging_product: 'whatsapp',
          pin: '123456',
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessTokenData}`,
          },
        }
      );

      await axios.post(
        `https://graph.facebook.com/v20.0/${this.businessIdData}/subscribed_apps`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.accessTokenData}`,
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  }

  launchWhatsAppSignup() {
    if (window.fbq) {
      window.fbq('trackCustom', 'WhatsAppOnboardingStart', {
        appId: this.appId,
        feature: 'whatsapp_embedded_signup',
      });
    }

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          this.loading = true;
        } else {
          console.log('User cancelled login or did not fully authorize.');
        }
      },
      {
        config_id: this.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          feature: 'whatsapp_embedded_signup',
          sessionInfoVersion: 2,
        },
      }
    );
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

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

.font-14 {
  font-size: 14px;
}

.text-600 {
  font-weight: 600;
}

.btn-disconnect {
  background-color: #c41b1b !important;
}

.btn-disconnect:hover {
  background-color: #971212 !important;
}

.btn-connect {
  background-color: #129965 !important;
}

.btn-connect:hover {
  background-color: #227c5b !important;
}

.btn-connect.disabled {
  background-color: #129965a4 !important;
  cursor: not-allowed;
}

.btn-connect.disabled:hover {
  background-color: #129965a4 !important;
}
</style>
