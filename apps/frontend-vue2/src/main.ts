import 'reflect-metadata';
import Vue from 'vue';
import App from './App.vue';
import router from './router';
import VueTypeScriptInject from 'vue-typescript-inject';

import '@/assets/styles/animations.scss';
import 'bootstrap/dist/css/bootstrap.min.css';
import store from './store';

import { ClientLibrary, ReactiveFormConfig } from '@rxweb/reactive-forms';

import 'vue-multiselect/dist/vue-multiselect.min.css';
import VModal from 'vue-js-modal';

import Vue2Filters from 'vue2-filters';
import vuetify from './plugins/vuetify';

import * as Sentry from '@sentry/vue';
import { Integrations } from '@sentry/tracing';

import { authPlugin } from './auth/auth';
import VueI18n from 'vue-i18n';
import VueApexCharts from 'vue-apexcharts';
import { messages, defaultLocale } from './languages/locales/index';
import VueGtm from '@gtm-support/vue2-gtm';
import FloatingVue from 'floating-vue';
import 'floating-vue/dist/style.css';
Vue.use(VueTypeScriptInject);

Vue.use(VModal, { dynamic: true, injectModalsContainer: true });
Vue.use(Vue2Filters);
Vue.use(VueI18n);
Vue.use(VueApexCharts);
Vue.use(FloatingVue);

Vue.config.productionTip = false;

interface ClarityFunction {
  (...args: any[]): void;
  q?: any[];
}
declare global {
  interface Window {
    env: any;
    clarity?: ClarityFunction;
  }
}

Vue.use(VueTypeScriptInject);
ReactiveFormConfig.clientLib = ClientLibrary.Vue;

ReactiveFormConfig.set({
  validationMessage: {
    required: 'Campo obrigatório.',
    minLength: 'São necessários {{1}} caracteres.',
    maxLength: 'Campo deve ter no máximo {{1}} caracteres.',
    alpha: 'Campo não permite caracteres especiais.',
    email: 'E-mail inválido.',
  },
});

Vue.use(VModal, { dialog: true });

Vue.filter('formatDate', (value: any, options: any) => {
  if (value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString(store.state.userLanguage, {
      ...(store.state.currentAccountTimezone && {
        timeZone: store.state.currentAccountTimezone,
      }),
      ...options,
    });
  } else {
    return '';
  }
});

Vue.filter('formatDateTime', (value: any, options: any) => {
  if (value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString(store.state.userLanguage, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(store.state.currentAccountTimezone && {
        timeZone: store.state.currentAccountTimezone,
        timeZoneName: 'short',
      }),
      ...options,
    });
  } else {
    return '-';
  }
});

Vue.filter('formatTime', (value: any, options: any) => {
  if (value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleTimeString(store.state.userLanguage, {
      hour: '2-digit',
      minute: '2-digit',
      ...(store.state.currentAccountTimezone && {
        timeZone: store.state.currentAccountTimezone,
        timeZoneName: 'short',
      }),
      ...options,
    });
  } else {
    return '-';
  }
});

Vue.filter('formatNumber', (value: any, options: any) => {
  if (value) {
    return Number(value).toLocaleString(store.state.userLanguage, options || {});
  } else {
    return 0;
  }
});

Vue.filter('formatNumberText', (value: any, options: any) => {
  if (value) {
    const formatter = Intl.NumberFormat(store.state.userLanguage, { notation: 'compact', ...options });
    return formatter.format(value).toUpperCase();
  } else {
    return 0;
  }
});

Vue.directive('time-mask', {
  bind(el) {
    el.addEventListener('input', (e: any) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
      let formattedValue = value;

      if (value.length > 2) {
        formattedValue = value.slice(0, 2) + ':' + value.slice(2);
      }

      e.target.value = formattedValue;
    });
  },
});

Vue.component('apexChart', VueApexCharts);

Vue.use(authPlugin);

if (process.env.VUE_APP_ENVIRONMENT !== 'development') {
  if (process.env.VUE_APP_GTM_ID) {
    Vue.use(VueGtm, {
      id: process.env.VUE_APP_GTM_ID,
      defer: false,
      compatibility: false,
      enabled: true,
      debug: false,
      vueRouter: router,
    });
  }

  if (process.env.VUE_APP_SENTRY_DSN) {
    const extraTracingOrigins = (process.env.VUE_APP_SENTRY_TRACING_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    Sentry.init({
      Vue,
      dsn: process.env.VUE_APP_SENTRY_DSN,
      environment: process.env.VUE_APP_ENVIRONMENT,
      integrations: [
        new Integrations.BrowserTracing({
          routingInstrumentation: Sentry.vueRouterInstrumentation(router),
          tracingOrigins: ['localhost', ...extraTracingOrigins, /^\//],
        }),
      ],

      tracesSampleRate: 0.3,
    });
  }

  const clarity: ClarityFunction = (...args: any[]): void => {
    (clarity.q = clarity.q || []).push(args);
  };
  const script: HTMLScriptElement = document.createElement('script');
  script.async = true;
  script.src = 'https://www.clarity.ms/tag/o1p50bbon7';

  const firstScript: HTMLScriptElement | null = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  }

  window.clarity = clarity;
}

export const i18n = new VueI18n({
  messages,
  locale: defaultLocale,
  fallbackLocale: 'pt-BR',
});

new Vue({
  router,
  store,
  vuetify,
  i18n,
  render: (h) => h(App),
}).$mount('#app');
