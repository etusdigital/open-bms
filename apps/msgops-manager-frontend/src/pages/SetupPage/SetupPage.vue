<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CheckmarkOutline } from '@vicons/ionicons5';
import Step1Admin from './steps/Step1Admin.vue';
import Step2Smtp from './steps/Step2Smtp.vue';
import Step3Domain from './steps/Step3Domain.vue';
import Step4Pool from './steps/Step4Pool.vue';
import { setupGateway } from '../../gateways/Setup';

const router = useRouter();

const currentStep = ref(1);

const steps = [
  { label: 'Administrador' },
  { label: 'SMTP' },
  { label: 'Domínio' },
  { label: 'IP Pool' },
];

const stepTitles: Record<number, string> = {
  1: 'Criar conta de administrador',
  2: 'Configurar servidor SMTP',
  3: 'URL base da plataforma',
  4: 'IP Pool e primeira conta',
};

onMounted(async () => {
  try {
    const status = await setupGateway.getStatus();
    if (status.configured) {
      router.replace('/');
      return;
    }
    currentStep.value = status.currentStep || 1;
  } catch {
    // API unreachable, keep step 1
  }
});

function advance() {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

function finish() {
  router.replace('/');
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
              'tw-mx-3 tw-h-px tw-w-12 tw-flex-shrink-0 tw-mb-5',
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
          <Step4Pool v-else-if="currentStep === 4" @step-complete="finish" />
        </Transition>
      </div>

    </div>
  </div>
</template>
