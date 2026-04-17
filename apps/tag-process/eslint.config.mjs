import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierPlugin,
  {
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
      '@typescript-eslint/no-require-imports': 'off',
      'no-case-declarations': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-assignment': 'off',
      'no-unsafe-finally': 'off',
      'preserve-caught-error': 'off',
      'prettier/prettier': [
        'error',
        { singleQuote: true, printWidth: 120, trailingComma: 'all' },
      ],
    },
  },
  { ignores: ['dist/', 'node_modules/'] },
);
