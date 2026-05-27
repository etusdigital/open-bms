import { use, useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatisticsContext, type MetricVisibility } from '../context/statistics-context';
import { EMAIL_METRICS, PUSH_METRICS, PER_USER_METRICS } from '../constants';

interface CustomizeMetricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeMetricsDialog({ open, onOpenChange }: CustomizeMetricsDialogProps) {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();

  const [draft, setDraft] = useState<MetricVisibility>({});

  // Sync draft from context when dialog opens
  useEffect(() => {
    if (open) {
      setDraft({ ...ctx.metricVisibility });
    }
  }, [open, ctx.metricVisibility]);

  const allMetrics = useMemo(
    () => [
      ...(ctx.messageType === 'email' ? EMAIL_METRICS : PUSH_METRICS),
      ...PER_USER_METRICS.filter((m) => m.types.includes(ctx.messageType)),
    ],
    [ctx.messageType],
  );

  const toggleMetric = useCallback((key: string) => {
    setDraft((prev) => ({
      ...prev,
      [key]: !(prev[key] !== false),
    }));
  }, []);

  const isVisible = (key: string) => draft[key] !== false;

  const handleSave = useCallback(() => {
    ctx.setMetricVisibility(draft);
    onOpenChange(false);
  }, [draft, ctx, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">{t('statistics.displayCustomization')}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6">
            {allMetrics.map((metric) => (
              <div key={metric.key} className="flex items-center justify-between border-b py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <GripVertical className="text-muted-foreground/40 h-4 w-4" />
                  <span className="text-sm">{t(metric.titleKey as never)}</span>
                </div>
                <Switch checked={isVisible(metric.key)} onCheckedChange={() => toggleMetric(metric.key)} />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {t('statistics.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {t('statistics.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
