import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useRulesForSelect } from '@/features/campaign-rules/use-campaign-rules';
import { useCampaignRuleStore } from '@/stores/campaign-rule-store';

const WEEK_DAYS = [
  { value: 0, labelKey: 'campaignRules.sunday' },
  { value: 1, labelKey: 'campaignRules.monday' },
  { value: 2, labelKey: 'campaignRules.tuesday' },
  { value: 3, labelKey: 'campaignRules.wednesday' },
  { value: 4, labelKey: 'campaignRules.thursday' },
  { value: 5, labelKey: 'campaignRules.friday' },
  { value: 6, labelKey: 'campaignRules.saturday' },
];

interface CampaignRulePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignRulePreviewModal({ open, onOpenChange }: CampaignRulePreviewModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: rules = [] } = useRulesForSelect();
  const setSchedule = useCampaignRuleStore((s) => s.setSchedule);

  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const selectedRule = useMemo(() => rules.find((r) => String(r.id) === selectedRuleId), [rules, selectedRuleId]);

  const allowedDays = selectedRule?.weekDays ?? [];

  // Set default rule when rules load
  if (rules.length > 0 && !selectedRuleId) {
    setSelectedRuleId(String(rules[0].id));
  }

  // Min/max dates: today to 30 days ahead
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const handleAdvance = () => {
    if (!selectedRule || !selectedDate) return;

    const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
    if (!allowedDays.includes(dayOfWeek)) {
      toast.error(t('campaigns.dateNotAllowed'));
      return;
    }

    // Sort configs by scheduleTo time
    const sortedConfigs = [...(selectedRule.configs ?? [])].sort((a, b) => {
      const timeA = (a.configs as any)?.scheduleTo ?? '00:00';
      const timeB = (b.configs as any)?.scheduleTo ?? '00:00';
      return timeA.localeCompare(timeB);
    });

    setSchedule({ date: selectedDate, configs: sortedConfigs });
    onOpenChange(false);
    navigate({ to: '/campaigns/from-rule' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('campaigns.pageTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('sidebar.campaignRules')}</Label>
              <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rules.map((rule) => (
                    <SelectItem key={rule.id} value={String(rule.id)}>
                      {rule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('common.date')}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={today}
                max={maxDate}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('campaigns.permittedDays')}</Label>
            <div className="flex gap-2">
              {WEEK_DAYS.map((day) => {
                const isAllowed = allowedDays.includes(day.value);
                return (
                  <div
                    key={day.value}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                      isAllowed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {String(t(day.labelKey as never)).charAt(0)}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAdvance} disabled={!selectedRuleId || !selectedDate}>
              {t('campaigns.next')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
