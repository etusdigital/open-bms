import { useMemo } from 'react';
import { PanelLeftClose, PanelLeftOpen, LogOut, User as UserIcon, Sun, Moon, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/features/auth/use-auth';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useAppStore } from '@/stores/app-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/lib/theme';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MENU_ITEMS, SETTINGS_ITEM } from './sidebar-config';
import { SidebarNavLink } from './sidebar-nav-link';
import { SidebarNavGroup } from './sidebar-nav-group';
import { AccountSelector } from './account-selector';
import { LanguageSwitcher } from '@/features/settings/components/language-switcher';
import type { NavItem } from './sidebar-config';

export function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const { can } = usePermissions();
  const auth = useAppStore((s) => s.auth);
  const isSuperAdmin = auth.status === 'authenticated' && auth.effectiveRole === 'super_admin';

  const permissions = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.permissions : null));

  const visibleItems = useMemo(
    () =>
      MENU_ITEMS.filter(
        (item) => (!item.permission || can(item.permission)) && (!item.superAdminOnly || isSuperAdmin),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- permissions changes invalidate can()
    [can, isSuperAdmin, permissions],
  );

  const showSettings = !SETTINGS_ITEM.permission || can(SETTINGS_ITEM.permission);

  return (
    <aside
      className={cn(
        'border-sidebar-border bg-sidebar flex h-screen flex-col border-r transition-[width] duration-200',
        collapsed ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Top section — fixed: logo + account selector */}
      <div data-testid="sidebar-top" className="shrink-0">
        <div className={cn('flex items-center px-4 pt-4 pb-2', collapsed && 'justify-center px-2')}>
          <Link to="/analytics/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="BMS" className="h-8 w-8 object-contain" />
            {!collapsed && <span className="text-sidebar-foreground text-lg font-semibold">BMS</span>}
          </Link>
        </div>

        <div className={cn('px-3 py-2', collapsed && 'flex justify-center px-1')}>
          {!collapsed && (
            <span className="text-sidebar-muted mb-1 block px-1 text-xs font-medium">{t('sidebar.account')}</span>
          )}
          <AccountSelector collapsed={collapsed} />
        </div>

        <Separator className={cn('bg-sidebar-border', collapsed ? 'mx-2' : 'mx-3')} />
      </div>

      {/* Nav section — scrollable */}
      <div data-testid="sidebar-nav" className={cn('min-h-0 flex-1 overflow-y-auto py-2', collapsed ? 'px-1' : 'px-2')}>
        <nav className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemRenderer key={item.labelKey} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Bottom section — fixed */}
      <div data-testid="sidebar-bottom" className={cn('shrink-0 pt-1 pb-3', collapsed ? 'px-1' : 'px-2')}>
        {/* Settings */}
        {showSettings && <SidebarNavLink item={SETTINGS_ITEM} collapsed={collapsed} />}

        <Separator className={cn('bg-sidebar-border my-2', collapsed ? 'mx-1' : 'mx-0')} />

        {/* User menu (profile, theme, logout) */}
        <SidebarUserMenu collapsed={collapsed} />

        {/* Collapse toggle */}
        <CollapseButton collapsed={collapsed} onToggle={() => setSidebarCollapsed(!collapsed)} />
      </div>
    </aside>
  );
}

function NavItemRenderer({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  if (item.children) {
    return <SidebarNavGroup item={item} collapsed={collapsed} />;
  }
  return <SidebarNavLink item={item} collapsed={collapsed} />;
}

function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const { resolvedTheme, setTheme } = useTheme();
  const { logout } = useAuth();

  if (auth.status !== 'authenticated') return null;

  const { user, effectiveRole } = auth;
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logout().finally(() => {
      window.location.assign('/login');
    });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const themeLabel = resolvedTheme === 'dark' ? t('sidebar.themeDark') : t('sidebar.themeLight');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="user-menu-trigger"
          className={cn(
            'flex items-center rounded-md text-sm transition-colors',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed ? 'mx-auto h-9 w-9 justify-center' : 'w-full gap-3 px-3 py-2',
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={user.profile} alt={user.name} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm leading-tight font-medium">{user.name}</p>
                <p className="text-sidebar-muted truncate text-xs capitalize">{effectiveRole.replace('_', ' ')}</p>
              </div>
              <ChevronsUpDown className="text-sidebar-muted h-4 w-4 shrink-0" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="user-menu-content"
        side={collapsed ? 'right' : 'top'}
        align="start"
        className="w-56 p-1"
      >
        {/* Profile link */}
        <Link
          data-testid="user-menu-profile"
          to="/profile"
          className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
        >
          <UserIcon className="h-4 w-4" />
          {t('sidebar.profile')}
        </Link>

        {/* Theme toggle */}
        <button
          data-testid="theme-toggle"
          onClick={toggleTheme}
          className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
        >
          <ThemeIcon className="h-4 w-4" />
          {t('sidebar.theme')}: {themeLabel}
        </button>

        <Separator className="my-1" />

        <LanguageSwitcher />

        <Separator className="my-1" />

        {/* Logout */}
        <button
          data-testid="sign-out-button"
          onClick={handleLogout}
          className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
        >
          <LogOut className="h-4 w-4" />
          {t('sidebar.signOut')}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? t('sidebar.expand') : t('sidebar.collapse');

  const button = (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center rounded-md text-sm transition-colors',
        'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed ? 'mx-auto h-9 w-9 justify-center' : 'w-full gap-3 px-3 py-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
