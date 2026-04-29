import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';

export const Route = createFileRoute('/_authenticated/_layout/super-admin')({
  beforeLoad: () => {
    const isSuperAdmin = selectIsSuperAdmin(useAppStore.getState());
    if (!isSuperAdmin) {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
