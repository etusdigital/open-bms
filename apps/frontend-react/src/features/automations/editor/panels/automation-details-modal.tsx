import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/stores/app-store';
import { LabelMultiSelect } from '@/features/messages/components/label-multi-select';
import { useLabelsAll } from '@/features/messages/use-messages';

export interface AutomationMetadata {
  title: string;
  description: string;
  verticalType: string;
  target: string;
  isRateLimit: boolean;
  labels: Array<{ id: number; name: string }>;
}

interface AutomationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: AutomationMetadata;
  onSave: (metadata: AutomationMetadata) => void;
}

export function AutomationDetailsModal({ open, onOpenChange, metadata, onSave }: AutomationDetailsModalProps) {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const isInternal = auth.status === 'authenticated' ? auth.account.isInternal : false;
  const { data: allLabels = [] } = useLabelsAll();

  const [title, setTitle] = useState(metadata.title);
  const [description, setDescription] = useState(metadata.description);
  const [verticalType, setVerticalType] = useState(metadata.verticalType);
  const [target, setTarget] = useState(metadata.target);
  const [isRateLimit, setIsRateLimit] = useState(metadata.isRateLimit);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>(metadata.labels.map((l) => l.id));

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open) {
      setTitle(metadata.title);
      setDescription(metadata.description);
      setVerticalType(metadata.verticalType);
      setTarget(metadata.target);
      setIsRateLimit(metadata.isRateLimit);
      setSelectedLabelIds(metadata.labels.map((l) => l.id));
    }
  }, [open, metadata]);

  const handleSave = () => {
    onSave({
      title: title.trim(),
      description: description.trim(),
      verticalType,
      target,
      isRateLimit,
      labels: selectedLabelIds.map((id) => {
        const fromQuery = allLabels.find((l) => l.id === id);
        const fromMeta = metadata.labels.find((l) => l.id === id);
        return { id, name: fromQuery?.name ?? fromMeta?.name ?? '' };
      }),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('automations.editor.editDetails')}</DialogTitle>
          <DialogDescription>{t('automations.editor.editDetailsDescription')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) handleSave();
          }}
        >
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="automation-title">{t('automations.title')}</Label>
            <Input
              id="automation-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder={t('automations.editor.automationTitle')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="automation-description">{t('automations.editor.description')}</Label>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder={t('automations.editor.descriptionPlaceholder')}
            />
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label>{t('labels.pageTitle')}</Label>
            <LabelMultiSelect selectedIds={selectedLabelIds} onChange={setSelectedLabelIds} />
          </div>

          {/* Product (verticalType) — internal only */}
          {isInternal && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('automations.editor.product')}</Label>
                <Select value={verticalType} onValueChange={setVerticalType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cc">{t('automations.editor.creditCard')}</SelectItem>
                    <SelectItem value="emp">{t('automations.editor.loan')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target — internal only */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{t('automations.editor.target')}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CircleHelp className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">{t('automations.editor.targetTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={target || ''} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('automations.editor.selectTarget')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t('automations.editor.targetOpen')}</SelectItem>
                    <SelectItem value="click">{t('automations.editor.targetClick')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Rate Limit — internal only */}
          {isInternal && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t('automations.editor.rateLimit')}</p>
                <p className="text-muted-foreground text-xs">{t('automations.editor.rateLimitDescription')}</p>
              </div>
              <Switch checked={isRateLimit} onCheckedChange={setIsRateLimit} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
