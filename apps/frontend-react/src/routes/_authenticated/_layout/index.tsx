import { createFileRoute, Navigate } from '@tanstack/react-router';
import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@/types';

export const Route = createFileRoute('/_authenticated/_layout/')({
  component: HomePage,
});

const DEFAULT_ROUTE_MAP: { permission: Permission; route: string }[] = [
  { permission: 'analytics:dashboard_view', route: '/analytics/dashboard' },
  { permission: 'campaigns:view', route: '/campaigns' },
  { permission: 'automations:view', route: '/automations' },
  { permission: 'messages:view', route: '/messages' },
  { permission: 'audience:contacts_view', route: '/contacts' },
  { permission: 'infra:view', route: '/pools' },
  { permission: 'account:settings_view', route: '/settings' },
];

function HomePage() {
  const { can } = usePermissions();

  const defaultRoute = DEFAULT_ROUTE_MAP.find((r) => can(r.permission));

  if (defaultRoute) {
    return <Navigate to={defaultRoute.route} replace />;
  }

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Bem-vindo ao BMS</p>
    </div>
  );
}
