import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavItem } from './sidebar-config';

interface SidebarNavLinkProps {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
}

export function SidebarNavLink({ item, collapsed, nested }: SidebarNavLinkProps) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!item.route) return null;

  const Icon = item.icon;
  const label = t(item.labelKey as any) as string;
  const isActive = item.exactMatch
    ? pathname === item.route || pathname === item.route + '/'
    : pathname.startsWith(item.route);

  const link = (
    <Link
      to={item.route}
      className={cn(
        'flex items-center rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        collapsed ? 'mx-auto h-9 w-9 justify-center' : 'gap-3 px-3 py-2',
        nested && !collapsed && 'pl-10',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
