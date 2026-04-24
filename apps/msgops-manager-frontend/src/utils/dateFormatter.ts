export const dateFormatter = (value: string, userLanguage?: string, options?: Record<string, string>): string => {
  if (!value) return '';

  // Defaults to pt-br as a language while user store isn't complete
  return new Date(value).toLocaleString(userLanguage ?? 'pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  });
};
