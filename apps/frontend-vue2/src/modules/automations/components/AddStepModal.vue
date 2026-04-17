<template>
  <div class="w-100">
    <div class="form-group">
      <v-dialog scrollable v-model="showModal" @click:outside="hideModal" width="800">
        <div class="container-modal">
          <div class="card-top-items">
            <h4>{{ $t('create.addStep').toString() }}</h4>
            <span class="material-symbols-rounded cursor-pointer close-button" @click="hideModal"> close </span>
          </div>
          <div class="navbar-category">
            <a
              class="navbar-link"
              :class="selectedCategory === category.value ? 'link-active' : 'link-inactive'"
              v-for="(category, index) in stepsCategory"
              :key="`navbar-category-${index}`"
              @click="selectedCategory = category.value"
            >
              {{ category.name }}
            </a>
          </div>

          <div class="steps-container">
            <div
              v-for="(item, index) in filteredAddOptions()"
              :key="`add-step-card${index}`"
              class="step-card"
              :class="!item.hasPermission ? 'card-step-disabled' : ''"
              :style="{ '--colorItem': item.color }"
              :disabled="!item.hasPermission"
              v-tooltip.bottom="!item.hasPermission && `${$t(`title.noAccess`)}`"
              @click="item.hasPermission && showStepType(item.type)"
            >
              <div :disabled="!item.hasPermission">
                <div class="d-flex justify-center align-items-center">
                  <div class="div-icon">
                    <span class="material-symbols-rounded" v-if="item.isMaterial"> {{ item.icon }} </span>
                    <img class="img-icon" :src="item.icon" alt="Icon" v-else />
                  </div>
                  <div class="text-container">
                    <div class="span-name">{{ item.name }}</div>
                    <p class="item-description mt-1">{{ item.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import AddStepButtonComponent from '@/components/add-step-button/AddStepButtonComponent.vue';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import { getAccountConfig } from '@/store';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';

export interface StepModalOptions {
  name: string;
  description: string;
  category: string;
  icon: string;
  type: string;
  color: string;
  hasPermission: boolean;
  isMaterial: boolean;
}

@Component({
  components: { AddStepButtonComponent },
  computed: {
    ...mapState(['currentAccount']),
  },
  props: ['dialog', 'stepId'],
})
export default class AddStepModal extends Vue {
  @Prop() dialog!: boolean;
  @Prop() stepId!: number;
  public currentAccount!: AccountDto;

  emailSettings: any = {};
  smsSettings: any = {};
  pushSettings: any = {};
  mobilePushSettings: any = {};
  wppSettings: any = {};
  showModal = false;
  addOptions: StepModalOptions[] = [];
  selectedCategory = 'send';
  stepsCategory: { value: string; name: any }[] = [
    { value: 'send', name: this.$t('datatable.dispatch') },
    { value: 'contacts', name: this.$t('datatable.contacts') },
    { value: 'conditions', name: this.$t('datatable.conditions') },
    { value: 'integration', name: this.$t('title.integration') },
  ];
  isInternal = false;

  beforeMount() {
    this.isInternal = this.currentAccount.isInternal || false;
  }

  filteredAddOptions() {
    return this.addOptions.filter((item) => item.category === this.selectedCategory);
  }

  mounted() {
    this.selectedCategory = 'send';
    this.emailSettings = JSON.parse(getAccountConfig(this.currentAccount, 'email_settings')) || {};
    this.smsSettings = JSON.parse(getAccountConfig(this.currentAccount, 'sms_settings')) || {};
    this.pushSettings = JSON.parse(getAccountConfig(this.currentAccount, 'webpush_settings')) || {};
    this.wppSettings = JSON.parse(getAccountConfig(this.currentAccount, 'whatsapp_settings')) || {};
    this.mobilePushSettings = JSON.parse(getAccountConfig(this.currentAccount, 'mobilepush_settings')) || {};

    this.addOptions = [
      {
        name: this.$t('automation.emailMessage') as string,
        description: this.$t('description.sendEmail') as string,
        category: 'send',
        icon: 'email',
        type: 'email',
        color: '#0057f4',
        hasPermission: this.emailSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('automation.pushMessage') as string,
        description: this.$t('description.webNotification') as string,
        category: 'send',
        icon: 'computer',
        type: 'webPush',
        color: '#0057f4',
        hasPermission: this.pushSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('automation.smsMessage') as string,
        description: this.$t('description.sendSms') as string,
        category: 'send',
        icon: 'sms',
        type: 'sms',
        color: '#0057f4',
        hasPermission: this.smsSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('automation.mobilePushMessage') as string,
        description: this.$t('description.mobilePushNotification') as string,
        category: 'send',
        icon: 'smartphone',
        type: 'mobilePush',
        color: '#0057f4',
        hasPermission: this.mobilePushSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('automation.whatsappMessage') as string,
        description: this.$t('description.sendWhatsapp') as string,
        category: 'send',
        icon: require('@/assets/whatsapp.svg'),
        type: 'whatsapp',
        color: '#0057f4',
        hasPermission: this.wppSettings.isActive,
        isMaterial: false,
      },
      {
        name: this.$t('title.testCampaign') as string,
        description: this.$t('description.testAB') as string,
        category: 'send',
        icon: require('@/assets/campaign_test_ab.svg'),
        type: 'testAB',
        color: '#0057f4',
        hasPermission: true,
        isMaterial: false,
      },
      {
        name: this.$t('title.randomEmail') as string,
        description: this.$t('description.multipleEmails') as string,
        category: 'send',
        icon: 'stacked_email',
        type: 'randomMessage',
        color: '#0057f4',
        hasPermission: this.emailSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('title.randomWebPush') as string,
        description: this.$t('description.multipleWebPush') as string,
        category: 'send',
        icon: 'computer',
        type: 'randomWebPush',
        color: '#0057f4',
        hasPermission: this.pushSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('title.randomMobilePush') as string,
        description: this.$t('description.multipleMobilePush') as string,
        category: 'send',
        icon: 'smartphone',
        type: 'randomMobilePush',
        color: '#0057f4',
        hasPermission: this.mobilePushSettings.isActive,
        isMaterial: true,
      },
      {
        name: this.$t('button.addTag') as string,
        description: this.$t('description.tag') as string,
        category: 'contacts',
        icon: 'shoppingmode',
        type: 'addTag',
        color: '#0FB75C',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('button.removeTag') as string,
        description: this.$t('description.removeTag') as string,
        category: 'contacts',
        icon: 'shoppingmode',
        type: 'removeTag',
        color: '#f06158',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('button.addCustomField') as string,
        description: this.$t('description.customField') as string,
        category: 'contacts',
        icon: 'layers',
        type: 'updateCustomField',
        color: '#076E62',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('button.validateEmail') as string,
        description: this.$t('description.validateEmail') as string,
        category: 'contacts',
        icon: 'verified_user',
        type: 'contactValidate',
        color: '#076E62',
        hasPermission: true,
        isMaterial: true,
      },
      ...(this.isInternal
        ? [
            {
              name: this.$t('title.contactTransfer') as string,
              description: this.$t('description.contactTransfer') as string,
              category: 'contacts',
              icon: 'move_up',
              type: 'contactTransfer',
              color: '#0031AF',
              hasPermission: true,
              isMaterial: true,
            },
            {
              name: this.$t('title.removeAutomation') as string,
              description: this.$t('description.removeAutomation') as string,
              category: 'contacts',
              icon: 'do_not_disturb_on',
              type: 'removeAutomation',
              color: '#f5802a',
              hasPermission: true,
              isMaterial: true,
            },
          ]
        : []),
      {
        name: this.$t('button.wait') as string,
        description: this.$t('description.wait') as string,
        category: 'conditions',
        icon: 'watch_later',
        type: 'wait',
        color: '#5c5c5c',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: 'Split',
        description: this.$t('description.split') as string,
        category: 'conditions',
        icon: 'arrow_split',
        type: 'split',
        color: '#FFC500',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('button.conditional') as string,
        description: this.$t('description.conditional') as string,
        category: 'conditions',
        icon: 'help',
        type: 'conditional',
        color: '#8C0758',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('button.timeCondition') as string,
        description: this.$t('description.timeCondition') as string,
        category: 'conditions',
        icon: 'update',
        type: 'conditionalTime',
        color: '#FF9654',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: this.$t('title.httpRequest') as string,
        description: this.$t('description.httpRequest') as string,
        category: 'integration',
        icon: 'language',
        type: 'httpRequest',
        color: '#3D2D8F',
        hasPermission: true,
        isMaterial: true,
      },
      {
        name: 'Active campaign',
        description: this.$t('description.infoActiveCampaign') as string,
        category: 'integration',
        icon: require('@/assets/active_campaign.svg'),
        type: 'activeCampaign',
        color: '#009BE4',
        hasPermission: true,
        isMaterial: false,
      },
      // {
      //   name: 'Trigger',
      //   description: this.$t('description.trigger'),
      //   icon: 'bolt',
      //   type: 'trigger',
      //   color: '#7b61ff',
      //   hasPermission: true,
      //   isMaterial: true,
      // },
    ];
  }

  hideModal() {
    this.showModal = false;
    this.$emit('hideModal');
  }

  showStepType(type: string) {
    this.$emit('showStepType', { type, id: this.$props.stepId }, true);
  }

  @Watch('dialog', { immediate: true })
  watchDialog() {
    this.showModal = this.dialog;
  }

  @Watch('showModal')
  watchShowModal() {
    if (this.showModal === false) {
      this.hideModal();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.close-button {
  font-weight: 600;
  color: $ds-gray-400;
}

.container-modal {
  padding: 20px;
  flex-direction: column;
  gap: 16px;
  border-radius: 16px;
  overflow-y: auto;
  background: $neutral-basic-white;
  min-height: 505px !important;
  box-shadow: 0px 4px 6px 0px rgba(0, 0, 0, 0.1), 0px 2px 4px 0px rgba(0, 0, 0, 0.06);
  & .card-top-items {
    display: flex;
    justify-content: space-between;
    align-items: center;

    & h4 {
      color: $ds-gray;
      font-size: 20px;
      font-weight: 600;
    }
  }
}

.navbar-category {
  display: flex;
  height: 52px;
  width: auto;
  width: 100%;
  border-radius: 16px;
  margin-top: 16px;
  margin-bottom: 16px;
  padding: 16px;
  align-items: center;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  background-color: $neutral-basic-white;
}

.navbar-link {
  font-size: 14px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0.05em;
  margin-right: 32px;
  text-align: center;
}
.link-active {
  color: $ds-blue;
}
.link-inactive {
  color: $ds-gray;
}

.steps-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.step-card {
  display: flex;
  min-height: 99px;
  max-height: 99px;
  padding: 16px;
  border-radius: 16px;
  gap: 24px;
  justify-content: center;
  align-items: center;
  &:hover {
    cursor: pointer;
    background-color: $ds-gray-100;
  }
}

.div-icon {
  display: flex;
  min-width: 48px;
  min-height: 48px;
  max-width: 48px;
  max-height: 48px;
  border-radius: 24px;
  justify-content: center;
  align-items: center;
  font-size: 29px;
  color: $neutral-basic-white;
  background-color: var(--colorItem);
}
.icon {
  font-size: 29px;
  color: $neutral-basic-white;
}
.text-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-self: center;
  margin-left: 16px;
}
.span-name {
  color: var(--colorItem);
  font-size: 16px;
  font-weight: 600;
  line-height: 130%;
}
.item-description {
  height: fit-content;
  color: $ds-gray;
  font-size: 14px;
  font-weight: 400;
  line-height: 150%;
  margin-bottom: 0px;
  margin-right: -10px;
}
.card-step-disabled {
  span,
  p {
    color: $ds-gray-300;
  }
  .span-name {
    color: $ds-gray-300;
  }
  .div-icon {
    color: $neutral-basic-white;
    background-color: $ds-gray-300 !important;
  }
  & span {
    color: $neutral-basic-white;
  }
}
.card-step-disabled:active {
  pointer-events: none;
}
.img-icon {
  height: 24SSpx;
  width: 24px;
  filter: invert(100%) sepia(94%) saturate(20%) hue-rotate(245deg) brightness(164%) contrast(100%);
}
</style>
