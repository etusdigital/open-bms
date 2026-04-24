/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import eslintPlugin from 'vite-plugin-eslint';

// vite-plugin-vuetify was removed — its tree-shaken auto-import targets
// vuetify/lib/components/* paths that Vuetify 3.12+ no longer exports.
// Components are registered globally via createVuetify({ components }) in main.ts.

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), eslintPlugin()],
  test: {
    globals: true,
  },
});
