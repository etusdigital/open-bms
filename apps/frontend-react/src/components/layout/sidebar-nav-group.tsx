import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SidebarNavLink } from './sidebar-nav-link';
import type { NavItem } from './sidebar-config';
import { usePermissions } from '@/hooks/use-permissions';

interface SidebarNavGroupProps {
  item: NavItem;
  collapsed: boolean;
}

export function SidebarNavGroup({ item, collapsed }: SidebarNavGroupProps) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = usePermissions();

  const visibleChildren = (item.children || []).filter(
    (child) => !child.permission || can(child.permission),
  );

  const isChildActive = visibleChildren.some((child) => isRouteActiveCheck(child, pathname));

  const [open, setOpen] = useState(isChildActive);

  if (visibleChildren.length === 0) return null;

  const Icon = item.icon;

  if (collapsed) {
    return (
      <CollapsedNavGroup item={item} icon={Icon} visibleChildren={visibleChildren} isChildActive={isChildActive} />
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isChildActive
            ? 'text-sidebar-accent-foreground'
            : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
        <span className="flex-1 truncate text-left">{t(item.labelKey as any)}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={1.5} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-0.5">
          {visibleChildren.map((child) => (
            <SidebarNavLink key={child.route || child.labelKey} item={child} collapsed={false} nested />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function isRouteActiveCheck(child: NavItem, pathname: string): boolean {
  if (!child.route) return false;
  if (child.exactMatch) return pathname === child.route || pathname === child.route + '/';
  return pathname.startsWith(child.route);
}

function CollapsedNavGroup({
  item,
  icon: Icon,
  visibleChildren,
  isChildActive,
}: {
  item: NavItem;
  icon: NavItem['icon'];
  visibleChildren: NavItem[];
  isChildActive: boolean;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hovering, setHovering] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.right + 8 });
    }
    setHovering(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setHovering(false), 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={cn(
          'mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
          isChildActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
      </button>

      {hovering &&
        createPortal(
          <div
            ref={flyoutRef}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className="bg-popover animate-in fade-in-0 zoom-in-95 fixed z-50 min-w-44 rounded-md border p-1 shadow-md"
            style={{ top: position.top, left: position.left }}
          >
            <p className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">{t(item.labelKey as any)}</p>
            <div className="space-y-0.5">
              {visibleChildren.map((child) => {
                if (!child.route) return null;
                const label = t(child.labelKey as any) as string;
                const isActive = isRouteActiveCheck(child, pathname);
                return (
                  <Link
                    key={child.route}
                    to={child.route}
                    onClick={() => setHovering(false)}
                    className={cn(
                      'flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50',
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
