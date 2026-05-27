# @msgops/typescript-config

Shared `tsconfig.json` presets for the workspace. Each app extends from one of
the configs here (`base`, `node`, `nestjs`, `library`, etc.) so compiler
options stay consistent.

## Usage

In an app's `tsconfig.json`:

```jsonc
{
  "extends": "@msgops/typescript-config/nestjs.json",
  "compilerOptions": {
    /* app-specific overrides */
  },
}
```
