import { apiClient } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore, type AuthUser } from '@/stores/app-store';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

interface UpdateProfilePayload {
  name?: string;
  email?: string;
  profile?: string | null;
  settings?: Record<string, string>;
}

interface UpdatePasswordPayload {
  password: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data } = await apiClient.put('/users/me', payload);
      return data;
    },
    onSuccess: (_data, payload) => {
      const store = useAppStore.getState();
      if (store.auth.status === 'authenticated') {
        // Update store with new name/email
        const updatedUser: AuthUser = {
          ...store.auth.user,
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.email !== undefined && { email: payload.email }),
        };
        store.setAuthenticated({
          user: updatedUser,
          account: store.auth.account,
          userAccounts: store.auth.userAccounts,
          permissions: [...store.auth.permissions],
          effectiveRole: store.auth.effectiveRole,
          globalRole: store.auth.globalRole,
          isMasterUser: store.auth.isMasterUser,
          accountConfigs: store.auth.accountConfigs,
          timezone: store.auth.timezone,
        });

        // Update i18n language if changed
        const lang = payload.settings?.language;
        if (lang && lang !== i18n.language) {
          i18n.changeLanguage(lang);
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      }
      toast.success(i18n.t('profile.saved'));
    },
    onError: () => {
      toast.error(i18n.t('profile.saveError'));
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (payload: UpdatePasswordPayload) => {
      const { data } = await apiClient.put('/users/me/password', payload);
      return data;
    },
    onSuccess: () => {
      toast.success(i18n.t('profile.passwordUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('profile.passwordError'));
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      const { data } = await apiClient.post('/users/me/profile-picture', {
        name: file.name,
        data: base64,
      });

      return data.profile as string;
    },
    onSuccess: (imageUrl) => {
      const store = useAppStore.getState();
      if (store.auth.status === 'authenticated') {
        const updatedUser: AuthUser = {
          ...store.auth.user,
          profile: imageUrl,
        };
        store.setAuthenticated({
          user: updatedUser,
          account: store.auth.account,
          userAccounts: store.auth.userAccounts,
          permissions: [...store.auth.permissions],
          effectiveRole: store.auth.effectiveRole,
          globalRole: store.auth.globalRole,
          isMasterUser: store.auth.isMasterUser,
          accountConfigs: store.auth.accountConfigs,
          timezone: store.auth.timezone,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      }
      toast.success(i18n.t('profile.avatarUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('profile.avatarError'));
    },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
