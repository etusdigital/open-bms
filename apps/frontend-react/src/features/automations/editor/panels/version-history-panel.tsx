import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AuditRecord } from '../../use-automations';

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audits: AuditRecord[];
  isLoading: boolean;
  selectedAuditId: number | null;
  onSelectVersion: (audit: AuditRecord, isCurrentVersion: boolean) => void;
}

export function resolveUserDisplay(audit: { userName?: string; userEmail?: string; user: string }): string {
  // Prefer the resolved fields from the API
  if (audit.userName) return audit.userName;
  if (audit.userEmail) return audit.userEmail;
  // Legacy fallback: user field may be a JSON string
  try {
    const parsed = JSON.parse(audit.user);
    return parsed?.name ?? parsed?.email ?? 'Unknown';
  } catch {
    return audit.user || 'Unknown';
  }
}

function formatAuditDate(dateStr: string, showTime: boolean): string {
  try {
    const date = new Date(dateStr);
    const locale = i18n.language === 'pt-BR' ? ptBR : enUS;
    return showTime
      ? format(date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale })
      : format(date, "dd 'de' MMMM 'de' yyyy", { locale });
  } catch {
    return dateStr;
  }
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  audits,
  isLoading,
  selectedAuditId,
  onSelectVersion,
}: VersionHistoryPanelProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent className="sm:max-w-sm" showOverlay={false}>
        <SheetHeader>
          <SheetTitle>{t('automations.editor.history.title')}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-muted h-16 animate-pulse rounded" />
              ))}
            </div>
          ) : audits.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t('automations.editor.history.noVersions')}
            </p>
          ) : (
            <div className="relative">
              {/* Timeline track */}
              <div className="bg-border absolute top-2 bottom-2 left-3 w-px" />

              <div className="space-y-1">
                {audits.map((audit, index) => {
                  const isCurrentVersion = index === 0;
                  const isSelected = selectedAuditId === audit.id || (isCurrentVersion && selectedAuditId === null);
                  const email = resolveUserDisplay(audit);
                  const dateStr = formatAuditDate(audit.createdAt, !isCurrentVersion);

                  return (
                    <button
                      key={audit.id}
                      type="button"
                      onClick={() => onSelectVersion(audit, isCurrentVersion)}
                      className={cn(
                        'hover:bg-accent relative w-full rounded-md px-8 py-3 text-left transition-colors',
                        isSelected && 'bg-accent',
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute top-4 left-1.5 h-3 w-3 rounded-full border-2',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background',
                        )}
                      />

                      <div>
                        {isCurrentVersion && (
                          <Badge variant="default" className="mb-1 text-[10px]">
                            {t('automations.editor.history.currentVersion')}
                          </Badge>
                        )}
                        <p className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                          {dateStr}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
