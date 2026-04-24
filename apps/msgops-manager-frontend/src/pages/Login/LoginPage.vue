<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toFormValidator } from '@vee-validate/zod';
import * as zod from 'zod';
import { BmsButton, BmsTextField } from '../../components';
import { login as authLogin } from '../../composables/useAuth';
import brandLogo from '../../assets/brand-brius-md.svg';

const route = useRoute();
const router = useRouter();

const errorMessage = ref('');

const loginSchema = toFormValidator(
  zod.object({
    email: zod.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
    password: zod.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  }),
);

const { handleSubmit, values, isSubmitting } = useForm({
  initialValues: { email: '', password: '' },
  validationSchema: loginSchema,
});

const onSubmit = handleSubmit(async (v) => {
  errorMessage.value = '';
  try {
    await authLogin(v.email, v.password);
    const redirect = (route.query.redirect as string | undefined) || '/';
    await router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err?.response?.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível autenticar. Tente mais tarde.';
  }
});
</script>

<template>
  <div class="login-bg tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-px-4">
    <div class="tw-w-full tw-max-w-sm tw-rounded-2xl tw-bg-white tw-p-8 tw-shadow-md">
      <div class="tw-mb-6 tw-flex tw-justify-center">
        <img :src="brandLogo" alt="BMS" class="tw-h-9" />
      </div>

      <h1 class="tw-mb-1 tw-text-center tw-text-lg tw-font-bold tw-text-main-gray">Entrar</h1>
      <p class="tw-mb-6 tw-text-center tw-text-xs tw-text-gray">Use as credenciais do administrador da instância.</p>

      <form @submit.prevent="onSubmit">
        <BmsTextField type="email" name="email" label="E-mail" :value="values.email" :disabled="isSubmitting" placeholder="admin@seu-dominio.com" />
        <BmsTextField type="password" name="password" label="Senha" :value="values.password" :disabled="isSubmitting" placeholder="********" />

        <p v-if="errorMessage" class="tw-mb-4 tw-text-center tw-text-xs tw-text-red" role="alert">
          {{ errorMessage }}
        </p>

        <BmsButton type="submit" name="login" variant="primary" :disabled="isSubmitting" class="tw-w-full tw-justify-center">
          {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
        </BmsButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-bg {
  background-color: #0057f4;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.12), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(0, 0, 0, 0.25), transparent 55%),
    linear-gradient(160deg, #0057f4 0%, #0042c4 100%);
}
</style>
