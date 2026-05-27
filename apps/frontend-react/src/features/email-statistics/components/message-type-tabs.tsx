import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Mail, Bell } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { useAppStore, selectAccountChannels } from '@/stores/app-store';
import type { MessageType } from '../types';

interface MessageTypeTabsProps {
  activeType: MessageType;
}

export function MessageTypeTabs({ activeType }: MessageTypeTabsProps) {
  const { t } = useTranslation();
  const channels = useAppStore(useShallow(selectAccountChannels));

  const tabs = [
    ...(channels.email ? [{ type: 'email' as const, label: t('statistics.email'), icon: Mail }] : []),
    ...(channels.webPush ? [{ type: 'web-push' as const, label: t('statistics.webPush'), icon: Bell }] : []),
  ];

  return (
    <div className="bg-card flex gap-2 rounded-xl border p-3 shadow-sm">
      {tabs.map((tab) => {
        const isActive = tab.type === activeType;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.type}
            to="/analytics/dashboard"
            search={(prev: Record<string, unknown>) => ({ ...prev, channel: tab.type })}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
