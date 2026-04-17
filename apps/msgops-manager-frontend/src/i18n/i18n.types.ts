export const Locales = ['en-US', 'pt-BR'] as const;
export type Locale = (typeof Locales)[number];
