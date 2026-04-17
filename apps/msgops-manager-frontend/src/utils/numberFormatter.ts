import { useUserStore } from '../stores';

export const numberFormatter = (value: number): string => {
  const userStore = useUserStore();
  if (isNaN(value)) {
    value = 0;
  }

  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
    style: 'decimal',
  };

  const formatter = new Intl.NumberFormat(userStore.user?.settings.language ?? 'pt-BR', options);

  return formatter.format(value);
};
