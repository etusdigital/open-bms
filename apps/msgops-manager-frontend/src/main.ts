import { createApp } from 'vue';
import Toast, { PluginOptions } from 'vue-toastification';

// Vuetify
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import { createPinia } from './stores';
import { i18n } from './i18n';
import router from './router';
import App from './App.vue';
import './style.css';
import { userHttpGateway } from './gateways/User';
import { accountHttpGateway } from './gateways/Account';
import { loginHttpGateway } from './gateways/Login';
import { authHttpGateway } from './gateways/Auth';
import './toast.scss';

export const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
});

const options: PluginOptions = {
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: false,
  transition: 'Vue-Toastification__bounce',
  maxToasts: 20,
  newestOnTop: true,
};

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(Toast, options);
app.use(vuetify);
app.use(i18n);
app.use(router);
app.provide('loginGateway', loginHttpGateway);
app.provide('userGateway', userHttpGateway);
app.provide('accountGateway', accountHttpGateway);
app.provide('authGateway', authHttpGateway);
app.mount('#app');
