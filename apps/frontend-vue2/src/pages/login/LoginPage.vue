<template>
  <div class="login-page">
    <div class="login-card">
      <img src="@/assets/logoNameBrius.svg" alt="BMS" class="login-logo" />

      <h1 class="login-title">Entrar</h1>
      <p class="login-subtitle">Use suas credenciais de operação.</p>

      <form @submit.prevent="handleSubmit" novalidate autocomplete="on" method="post" action="#">
        <v-text-field
          id="login-email"
          v-model="email"
          type="email"
          name="email"
          label="E-mail"
          placeholder="voce@seu-dominio.com"
          outlined
          dense
          autocomplete="username"
          class="form-control"
          :disabled="submitting"
          :error-messages="touched && !email ? ['Informe seu e-mail'] : []"
        />
        <v-text-field
          id="login-password"
          v-model="password"
          type="password"
          name="password"
          label="Senha"
          placeholder="********"
          outlined
          dense
          autocomplete="current-password"
          class="form-control"
          :disabled="submitting"
          :error-messages="touched && password.length < 8 ? ['Senha deve ter ao menos 8 caracteres'] : []"
        />

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>

        <v-btn type="submit" class="login-submit" :disabled="submitting" depressed block>
          {{ submitting ? 'Entrando…' : 'Entrar' }}
        </v-btn>
      </form>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import store from '@/store';

export default Vue.extend({
  name: 'LoginPage',
  data() {
    return {
      email: '',
      password: '',
      submitting: false,
      touched: false,
      error: '',
    };
  },
  methods: {
    async handleSubmit() {
      this.touched = true;
      this.error = '';
      if (!this.email || this.password.length < 8) return;

      this.submitting = true;
      try {
        // Ensure the watch on loadAuth0 always fires by forcing a false→true transition.
        // Vuex watchers don't run when the committed value equals the current one, and
        // a stale true from a prior session would silently break the post-login redirect.
        store.commit('setLoadAuth0', false);
        await this.$auth.login(this.email, this.password);
        // Trigger App.vue's loadAuth0 watcher — it fetches /users/me and flips
        // authReady, which the router's beforeEach is blocked waiting on.
        store.commit('setLoadAuth0', true);
        const redirect = (this.$route.query.redirect as string) || '/';
        this.$router.push(redirect);
      } catch (err: any) {
        this.error = err?.response?.status === 401 ? 'E-mail ou senha inválidos.' : 'Falha ao autenticar. Tente novamente.';
      } finally {
        this.submitting = false;
      }
    },
  },
});
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-md;
  background-color: $ds-blue;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.12), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(0, 0, 0, 0.25), transparent 55%),
    linear-gradient(160deg, $ds-blue 0%, $ds-blue-dark 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: $spacing-xl $spacing-lg;
  background: $neutral-basic-white;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: 'Inter', sans-serif;
}

.login-logo {
  display: block;
  height: 32px;
  margin: 0 auto $spacing-lg;
}

.login-title {
  margin: 0 0 $spacing-xs;
  font-size: 22px;
  font-weight: 700;
  color: $ds-gray;
  text-align: center;
  letter-spacing: -0.01em;
}

.login-subtitle {
  margin: 0 0 $spacing-lg;
  font-size: 13px;
  color: $neutral-gray-600;
  text-align: center;
  line-height: 1.5;
}

.login-error {
  margin: 0 0 $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  background: rgba($ds-red, 0.08);
  border-left: 2px solid $ds-red;
  font-size: 12px;
  color: $ds-red;
  line-height: 1.4;
}

/* Vuetify field overrides — scoped to this card only */
::v-deep .login-card .form-control {
  margin-bottom: $spacing-sm;
}

::v-deep .login-card .form-control .v-input__slot {
  min-height: 44px;
  border-radius: 8px !important;
}

::v-deep .login-card .form-control .v-text-field__details {
  padding-top: 4px;
  min-height: 18px;
}

::v-deep .login-card .form-control.v-input--is-focused fieldset {
  border-color: $ds-blue !important;
  border-width: 2px;
}

.login-submit {
  margin-top: $spacing-md;
  height: 44px !important;
  background-color: $ds-blue !important;
  color: $neutral-basic-white !important;
  border-radius: 8px !important;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.07em;
  text-transform: uppercase;

  &:disabled {
    opacity: 0.7;
  }

  &:not(:disabled):hover {
    background-color: $ds-blue-dark !important;
  }
}
</style>
