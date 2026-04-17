import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierPlugin,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
