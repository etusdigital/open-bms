module.exports = {
  env: {
    node: true,
  },
  ignorePatterns: ['*.d.ts'],
  rules: {
    'vue/require-default-prop': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
  },
  extends: ['plugin:vue/vue3-recommended', 'eslint:recommended', '@vue/typescript/recommended', 'prettier'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: {
      // Script parser for `<script>`
      js: 'espree',

      // Script parser for `<script lang="ts">`
      ts: '@typescript-eslint/parser',

      // Script parser for vue directives (e.g. `v-if=` or `:attribute=`)
      // and vue interpolations (e.g. `{{variable}}`).
      // If not specified, the parser determined by `<script lang ="...">` is used.
      '<template>': 'espree',
    },
  },
};
