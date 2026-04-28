<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ 'step-complete': [] }>();

const schema = toTypedSchema(
  z.object({
    baseUrl: z.string().url('URL inválida. Ex: https://app.empresa.com'),
  })
);

const { handleSubmit, isSubmitting } = useForm({
  initialValues: { baseUrl: '' },
  validationSchema: schema,
});

const onSubmit = handleSubmit(async (values) => {
  try {
    await setupGateway.advanceStep(3, { baseUrl: values.baseUrl });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao salvar URL base.' });
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit">
    <BmsTextField
      name="baseUrl"
      label="URL base da plataforma"
      placeholder="https://app.empresa.com"
    />
    <p class="tw-mb-4 tw-text-xs tw-text-gray">
      Usada em links de emails, redirecionamentos e integrações externas.
    </p>

    <div class="tw-flex tw-justify-end">
      <BmsButton name="btn-step3" type="submit" variant="primary" :disabled="isSubmitting">
        Salvar e continuar
      </BmsButton>
    </div>
  </form>
</template>
