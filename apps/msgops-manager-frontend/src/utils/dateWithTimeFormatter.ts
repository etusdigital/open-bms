export const dateWithTimeFormatter = (value: string, timePreposition: string, userLanguage?: string): string => {
  if (!value) return '';

  // Defaults to pt-br as a language while user store isn't complete
  return new Date(value).toLocaleString(userLanguage ?? 'pt-BR').replace(',', timePreposition);
};
