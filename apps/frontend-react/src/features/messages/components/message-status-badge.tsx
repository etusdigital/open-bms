import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MessageStatus } from '../types';

const STATUS_STYLES: Record<MessageStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  send_approval:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700',
  sent_approval:
    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
  approved:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700',
  rejected: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
};

interface MessageStatusBadgeProps {
  status: MessageStatus;
  className?: string;
}

export function MessageStatusBadge({ status, className }: MessageStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {t(`messages.status_${status}`)}
    </Badge>
  );
}
