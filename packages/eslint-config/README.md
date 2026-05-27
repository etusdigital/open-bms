# @msgops/eslint-config

Shared ESLint configuration for the workspace. Each app's `eslint.config.mjs`
extends from here so lint rules stay consistent across the monorepo.

## Usage

In an app's `eslint.config.mjs`:

```js
import baseConfig from '@msgops/eslint-config';

export default [...baseConfig /* app-specific overrides */];
```
