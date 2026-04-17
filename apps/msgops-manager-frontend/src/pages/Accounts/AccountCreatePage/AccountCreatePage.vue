<script setup lang="ts">
import { InvalidSubmissionHandler, useForm } from 'vee-validate';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  BriusPageBase,
  BriusPageTitleWithPlusAction,
  BriusButton,
  BriusTextField,
  BriusSelect,
} from '../../../components';
import { useAccountStore } from '../../../stores';
import { CreateAccount, accountCreateZodValidation, SendgridDns, Account } from '../../../entities/Account';
import { showToast } from '../../../utils/showToast';
import { ref, Ref } from 'vue';
import { onBeforeMount } from 'vue';

const router = useRouter();
const { t } = useI18n();

const formValues: CreateAccount = {
  name: '',
  description: '',
  createSendgridAccount: false,
  defaultDomain: '',
  unsubscribeRedirectUrl: '',
  linkBranding: '',
  isActive: true,
  sendgridIps: [],
  sendgridUser: '',
  accountConfigs: [],
};

const shouldShowDnsTable: Ref<boolean> = ref(false);
const createSendgridAccount: Ref<boolean> = ref(false);
const selectedIps: Ref<string[]> = ref([]);
const sendgridIps: Ref<any[]> = ref([]);
const sendgridUsers: Ref<string[]> = ref([]);
const account: Ref<{ account: Account; dns?: SendgridDns }> = ref({} as { account: Account; dns?: SendgridDns });
const selectIps = (ip: string) => {
  if (selectedIps.value.includes(ip)) {
    selectedIps.value.splice(selectedIps.value.indexOf(ip), 1);
    return;
  }

  selectedIps.value.push(ip);
};

const { createAccount, fetchIps, fetchSendgridUsers } = useAccountStore();
const { handleSubmit, isSubmitting } = useForm({
  initialValues: formValues,
  validationSchema: accountCreateZodValidation,
});

const time_zone: Ref<string> = ref('America/Sao_Paulo');
const default_country: Ref<string> = ref('BR');
const emailSettingsIsActive: Ref<boolean> = ref(true);
const webpushSettingsIsActive: Ref<boolean> = ref(true);
const smsSettingsIsActive: Ref<boolean> = ref(false);
const whatsappSettingsIsActive: Ref<boolean> = ref(false);

const onInvalidSubmit: InvalidSubmissionHandler<CreateAccount> = ({ errors }) => {
  showToast({ type: 'error', description: t('accountPage.error') });
  console.error(errors);
};

const onSubmit = handleSubmit(async (values, { resetForm }) => {
  values.sendgridIps = selectedIps.value;
  values.createSendgridAccount = createSendgridAccount.value;

  values.accountConfigs?.push({ name: 'time_zone', value: time_zone.value });
  values.accountConfigs?.push({ name: 'default_country', value: default_country.value });
  values.accountConfigs?.push({
    name: 'email_settings',
    value: { isActive: !!emailSettingsIsActive.value, validateEmails: true },
  });
  values.accountConfigs?.push({ name: 'webpush_settings', value: { isActive: !!webpushSettingsIsActive.value } });
  values.accountConfigs?.push({ name: 'sms_settings', value: { isActive: !!smsSettingsIsActive.value } });
  values.accountConfigs?.push({ name: 'whatsapp_settings', value: { isActive: !!whatsappSettingsIsActive.value } });

  account.value = await createAccount(values);
  showToast({ type: 'success', description: t('accountPage.success') });
  if (account.value.dns) {
    shouldShowDnsTable.value = true;
    return;
  }
  resetForm();
  router.push({ name: 'accountsPage' });
}, onInvalidSubmit);

onBeforeMount(async () => {
  sendgridIps.value = await fetchIps();
  const sendgridUsersData = await fetchSendgridUsers();
  sendgridUsers.value = sendgridUsersData.map((user: any) => user.username);
});

const onCancel = () => {
  router.back();
};
</script>

<template>
  <BriusPageBase>
    <BriusPageTitleWithPlusAction>
      <template #subtitle>{{ $t('accountPage.accounts') }}</template>
      {{ $t('accountPage.addAccount').toLocaleLowerCase() }}
    </BriusPageTitleWithPlusAction>
    <form v-if="!shouldShowDnsTable" id="create-user" @submit.prevent="onSubmit">
      <div
        class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pb-1 tw-pt-5 tw-shadow-md"
      >
        <div class="tw-grid tw-grid-cols-1 tw-gap-1">
          <BriusTextField name="name" :label="$t('name')" :placeholder="$t('typeHere')" type="text" />
          <BriusTextField
            name="description"
            :label="$t('accountPage.description')"
            :placeholder="$t('typeHere')"
            type="text"
          />
        </div>
      </div>

      <div
        class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pb-1 tw-pt-5 tw-shadow-md"
      >
        <div class="tw-grid tw-grid-cols-1 tw-gap-1">
          <div class="tw-mb-4">
            <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="time_zone">
              {{ $t('accountPage.timeZone') }}
            </label>
            <div
              class="focus:tw-shadow-outline tw-flex tw-w-full tw-appearance-none tw-items-center tw-rounded-lg tw-border tw-border-gray-light tw-px-3 tw-py-2 tw-leading-tight tw-text-main-gray tw-shadow focus:tw-outline-none"
            >
              <input
                id="time_zone"
                v-model="time_zone"
                name="time_zone"
                type="text"
                class="tw-bg-transparent tw-mr-3 tw-w-full tw-appearance-none tw-border-none tw-py-0.5 tw-text-xs tw-leading-tight tw-text-main-gray focus:tw-outline-none"
              />
            </div>
          </div>

          <div class="tw-mb-4">
            <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="default_country">
              {{ $t('accountPage.defaultCountry') }}
            </label>
            <div
              class="focus:tw-shadow-outline tw-flex tw-w-full tw-appearance-none tw-items-center tw-rounded-lg tw-border tw-border-gray-light tw-px-3 tw-py-2 tw-leading-tight tw-text-main-gray tw-shadow focus:tw-outline-none"
            >
              <input
                id="default_country"
                v-model="default_country"
                name="default_country"
                type="text"
                class="tw-bg-transparent tw-mr-3 tw-w-full tw-appearance-none tw-border-none tw-py-0.5 tw-text-xs tw-leading-tight tw-text-main-gray focus:tw-outline-none"
              />
            </div>
          </div>

          <BriusTextField
            name="defaultDomain"
            :label="$t('accountPage.defaultDomain')"
            placeholder="https://domain.com"
            type="text"
          />
          <BriusTextField
            name="unsubscribeRedirectUrl"
            :label="$t('accountPage.unsubscribeRedirectUrl')"
            placeholder="https://domain.com/unsubscribe"
            type="text"
          />
        </div>
      </div>

      <div
        class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pb-1 tw-pt-5 tw-shadow-md"
      >
        <div class="tw-grid tw-grid-cols-1 tw-gap-1">
          <div class="tw-mb-4 tw-flex tw-items-center">
            <input
              id="service-email-isActive"
              v-model="emailSettingsIsActive"
              type="checkbox"
              name="emailSettingsIsActive"
            />
            <label class="tw-ml-2 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="service-email-isActive">
              Email service
            </label>
          </div>
          <div class="tw-mb-4 tw-flex tw-items-center">
            <input
              id="service-webpush-isActive"
              v-model="webpushSettingsIsActive"
              type="checkbox"
              name="webpushSettingsIsActive"
            />
            <label class="tw-ml-2 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="service-webpush-isActive">
              Webpush service
            </label>
          </div>
          <div class="tw-mb-4 tw-flex tw-items-center">
            <input id="service-sms-isActive" v-model="smsSettingsIsActive" type="checkbox" name="smsSettingsIsActive" />
            <label class="tw-ml-2 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="service-sms-isActive">
              SMS service
            </label>
          </div>
          <div class="tw-mb-4 tw-flex tw-items-center">
            <input
              id="service-whatsapp-isActive"
              v-model="whatsappSettingsIsActive"
              type="checkbox"
              name="whatsappSettingsIsActive"
            />
            <label class="tw-ml-2 tw-block tw-text-xs tw-font-bold tw-text-main-gray" for="service-whatsapp-isActive">
              Whatsapp service
            </label>
          </div>
        </div>
      </div>

      <div
        class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pb-1 tw-pt-5 tw-shadow-md"
      >
        <div class="tw-grid tw-grid-cols-1 tw-gap-1">
          <label for="checkbox-createSendgridAccount" class="tw-mb-2">
            <input
              id="checkbox-createSendgridAccount"
              v-model="createSendgridAccount"
              name="createSendgridAccount"
              type="checkbox"
            />
            Create a new sendgrid's subuser or...
          </label>

          <BriusSelect
            v-if="!createSendgridAccount"
            name="sendgridUser"
            :label="$t('accountPage.sendgridUser')"
            :placeholder="$t('select')"
          >
            <slot>
              <option value="" selected>{{ $t('accountPage.sendgridUser') }}</option>
              <option v-for="user in sendgridUsers" :key="user" :value="user">
                {{ user }}
              </option>
            </slot>
          </BriusSelect>

          <BriusTextField
            name="linkBranding"
            :label="$t('accountPage.linkBranding')"
            :placeholder="$t('accountPage.linkBrandingPlaceholder')"
            type="text"
          />

          <div v-if="createSendgridAccount">
            <h2 class="tw-text-small">Select IP(s) for this sendgrid account:</h2>
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table class="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th class="py-3.5 pr-3 text-left text-sm font-semibold text-gray-light">IP</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-light">RDNS</th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-light">Sub-users</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white">
                    <tr v-for="ip in sendgridIps" :key="ip" class="even:bg-gray-light">
                      <td class="whitespace-nowrap py-4 pl-4pr-3 text-sm font-medium text-gray-light" width="200">
                        <label>
                          <input type="checkbox" :value="ip.ip" @click="selectIps(ip.ip)" />
                          {{ ip.ip }}
                        </label>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        {{ ip.rdns }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        <span v-for="subuser in ip.subusers" :key="`subuser-${subuser}`" class="mr-2 bg-gray-600">
                          {{ subuser }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tw-flex tw-justify-end tw-gap-4">
        <BriusButton name="back-page" type="button" variant="secondary" :disabled="isSubmitting" @click="onCancel">
          {{ $t('cancel') }}
        </BriusButton>
        <BriusButton name="create-account" type="submit" :disabled="isSubmitting">{{ $t('save') }}</BriusButton>
      </div>
    </form>

    <div v-if="shouldShowDnsTable">
      <h2>Configurar DNS</h2>

      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-light sm:pl-3">
                    Type
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-light">Host</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-light">Value</th>
                </tr>
              </thead>
              <tbody class="bg-white">
                <tr v-for="(dns, index) in account.dns" :key="`dnstable-${index}`" class="even:bg-gray-light">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-light sm:pl-3">
                    {{ dns.type }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                    {{ dns.host }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                    {{ dns.data }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </BriusPageBase>
</template>
