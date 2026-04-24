import { useToast } from 'vue-toastification';
import { Alert } from '@vicons/ionicons5';

const toast = useToast();

export type showToastProps = {
  type: 'success' | 'error';
  description: string;
};

export const showToast = ({ type, description }: showToastProps) => {
  if (type === 'success') toast.success(description, { icon: false });
  if (type === 'error') toast.error(description, { icon: Alert });
};
