import { createFileRoute, redirect } from '@tanstack/react-router';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';
import IntegrationsPage from '@/features/super-admin/integrations/integrations-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/integrations')({
  beforeLoad: () => {
    const state = useAppStore.getState();
    if (state.auth.status !== 'authenticated') return;
    if (!selectIsSuperAdmin(state)) {
      throw redirect({ to: '/' });
    }
  },
  component: IntegrationsPage,
});
