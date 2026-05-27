import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';

function SuperAdminLayout() {
  return (
    <div className="flex flex-col h-full">
      <Outlet />
      <footer className="p-2 text-center text-xs text-muted-foreground border-t">
        IP geolocation by{' '}
        <a
          href="https://db-ip.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          DB-IP.com
        </a>
      </footer>
    </div>
  );
}

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
  component: SuperAdminLayout,
});
