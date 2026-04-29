import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';

export const Route = createFileRoute('/_authenticated/_layout/super-admin')({
  beforeLoad: () => {
    const state = useAppStore.getState();
    if (state.auth.status !== 'authenticated') {
      return;
    }
    if (!selectIsSuperAdmin(state)) {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
