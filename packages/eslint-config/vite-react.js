// Vite + React + TanStack flavour. Inherits the base TS rules from index.js
// and adds the react-hooks plugin so `eslint-disable-next-line
// react-hooks/exhaustive-deps` comments resolve (used widely in this app's
// components — without the plugin loaded ESLint errors on every disable).
//
// `rules-of-hooks` is intentionally OFF: TanStack Router's `Route.useSearch()`
// / `Route.useParams()` pattern is invoked from regular components and the
// rule false-positives every call. Re-enable only if the project moves away
// from the file-route pattern.
import baseConfig from './index.js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
