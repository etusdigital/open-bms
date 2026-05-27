import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function downloadBlobAsFile(response: { data: Blob }, filename: string) {
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useContactExport() {
  return useMutation({
    mutationFn: async (contactIds: number[]) => {
      const response = await apiClient.get('/contacts/export-stream', {
        params: { contacts: contactIds },
        responseType: 'blob',
      });
      const timestamp = new Date().toISOString().slice(0, 10);
      await downloadBlobAsFile(response, `contacts-${timestamp}.csv`);
    },
    onSuccess: () => {
      toast.success(i18n.t('contacts.exportSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.exportError'));
    },
  });
}
