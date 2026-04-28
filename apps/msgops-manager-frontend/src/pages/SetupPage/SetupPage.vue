<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../composables/useAuth';
import { CheckmarkOutline } from '@vicons/ionicons5';
import Step1Admin from './steps/Step1Admin.vue';
import Step2Smtp from './steps/Step2Smtp.vue';
import Step3Domain from './steps/Step3Domain.vue';
import Step4Sendgrid from './steps/Step4Sendgrid.vue';
import Step5Pool from './steps/Step5Pool.vue';
import Step6HealthCheck from './steps/Step6HealthCheck.vue';
import { setupGateway } from '../../gateways/Setup';

const router = useRouter();

const currentStep = ref(1);
const adminCredentials = ref<{ email: string; password: string } | null>(null);

const steps = [
  { label: 'Administrador' },
  { label: 'SMTP' },
  { label: 'Domínio' },
  { label: 'SendGrid' },
  { label: 'IP Pool' },
  { label: 'Health Check' },
];

const stepTitles: Record<number, string> = {
  1: 'Criar conta de administrador',
  2: 'Configurar servidor SMTP',
  3: 'URL base da plataforma',
  4: 'Provedor de envio em massa (SendGrid)',
  5: 'IP Pool e primeira conta',
  6: 'Verificação de serviços',
};

onMounted(async () => {
  try {
    const status = await setupGateway.getStatus();
    if (status.configured) {
      router.replace('/');
      return;
    }
    currentStep.value = status.currentStep || 1;
  } catch (err) {
    console.warn('[setup] getStatus failed, starting at step 1', err);
  }
});

function advance(payload?: { email: string; password: string }) {
  if (currentStep.value === 1 && payload) {
    adminCredentials.value = payload;
  }
  if (currentStep.value < 6) {
    currentStep.value++;
  }
}

async function finish() {
  if (adminCredentials.value) {
    try {
      await login(adminCredentials.value.email, adminCredentials.value.password);
      router.replace('/');
    } catch {
      router.replace('/login');
    }
  } else {
    router.replace('/login');
  }
}
</script>

<template>
  <div class="tw-min-h-screen tw-bg-gray-light tw-flex tw-items-center tw-justify-center tw-px-4 tw-py-12">
    <div class="tw-w-full tw-max-w-xl">

      <!-- Logo / Title -->
      <div class="tw-text-center tw-mb-8">
        <h1 class="tw-text-2xl tw-font-semibold tw-text-main-gray tw-tracking-wider">
          Configuração inicial da plataforma
        </h1>
        <p class="tw-mt-1 tw-text-sm tw-text-gray">
          Complete os passos abaixo para começar a usar o sistema.
        </p>
      </div>

      <!-- Step Indicator -->
      <div class="tw-flex tw-items-center tw-justify-center tw-mb-8">
        <template v-for="(step, i) in steps" :key="i">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-1">
            <div
              :class="[
                'tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-full tw-text-xs tw-font-bold tw-transition-all',
                i + 1 < currentStep
                  ? 'tw-bg-primary tw-text-white'
                  : i + 1 === currentStep
                    ? 'tw-bg-primary tw-text-white tw-ring-2 tw-ring-primary tw-ring-offset-2'
                    : 'tw-bg-gray-light tw-border tw-border-gray-300 tw-text-gray',
              ]"
            >
              <component :is="CheckmarkOutline" v-if="i + 1 < currentStep" class="tw-h-4 tw-w-4" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span
              :class="[
                'tw-text-[10px] tw-font-medium tw-whitespace-nowrap',
                i + 1 === currentStep ? 'tw-text-primary' : 'tw-text-gray',
              ]"
            >
              {{ step.label }}
            </span>
          </div>

          <div
            v-if="i < steps.length - 1"
            :class="[
              'tw-mx-2 tw-h-px tw-w-10 tw-flex-shrink-0 tw-mb-5',
              i + 1 < currentStep ? 'tw-bg-primary' : 'tw-bg-gray-light',
            ]"
          />
        </template>
      </div>

      <!-- Card -->
      <div class="tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-8 tw-pt-6 tw-pb-8 tw-shadow-md">
        <h2 class="tw-mb-5 tw-text-base tw-font-semibold tw-text-main-gray tw-tracking-wide">
          {{ stepTitles[currentStep] }}
        </h2>

        <Transition
          enter-from-class="tw-translate-x-4 tw-opacity-0"
          enter-active-class="tw-transition tw-duration-300"
          leave-active-class="tw-transition tw-duration-0 tw-opacity-0"
          mode="out-in"
        >
          <Step1Admin v-if="currentStep === 1" @step-complete="advance" />
          <Step2Smtp v-else-if="currentStep === 2" @step-complete="advance" />
          <Step3Domain v-else-if="currentStep === 3" @step-complete="advance" />
          <Step4Sendgrid v-else-if="currentStep === 4" @step-complete="advance" />
          <Step5Pool v-else-if="currentStep === 5" @step-complete="advance" />
          <Step6HealthCheck v-else-if="currentStep === 6" @step-complete="finish" />
        </Transition>
      </div>

    </div>
  </div>
</template>
