import { createFileRoute, Outlet } from '@tanstack/react-router';

// Layout route for /settings/*. The settings index lives in settings/index.tsx;
// account-scoped sub-pages (e.g. /settings/users) render through this Outlet.
export const Route = createFileRoute('/_authenticated/_layout/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
