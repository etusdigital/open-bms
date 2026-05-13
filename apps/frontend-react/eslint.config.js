import viteReactConfig from '@retention/eslint-config/vite-react';
import i18next from 'eslint-plugin-i18next';

export default [
  ...viteReactConfig,
  {
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'all',
          'jsx-attributes': {
            include: ['aria-label', 'placeholder', 'title', 'alt'],
            exclude: [
              'data-testid',
              'role',
              'aria-hidden',
              'src',
              'href',
              'to',
              'className',
              'id',
              'name',
              'type',
              'autoComplete',
            ],
          },
          callees: {
            include: [
              't',
              'i18n.t',
              'toast',
              'toast.success',
              'toast.error',
              'toast.info',
              'toast.warning',
              'z\\.string\\(\\)\\.min',
              'z\\.string\\(\\)\\.max',
              'z\\.string\\(\\)\\.email',
            ],
          },
          words: {
            exclude: ['^[a-z0-9_-]{1,3}$', '^[A-Z_]+$', '^[\\d\\W]+$'],
          },
        },
      ],
    },
  },
];
