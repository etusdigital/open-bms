import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { ColumnVisibility } from './use-column-visibility';

interface ColumnVisibilityDialogProps {
  visibility: ColumnVisibility;
  onSave: (visibility: ColumnVisibility) => void;
}

const CHANNEL_COLUMNS: { key: keyof ColumnVisibility; labelKey: string }[] = [
  { key: 'lastCountEmail', labelKey: 'segments.columns.email' },
  { key: 'lastCountWebPush', labelKey: 'segments.columns.webPush' },
  { key: 'lastCountMobilePush', labelKey: 'segments.columns.mobilePush' },
  { key: 'lastCountPhone', labelKey: 'segments.columns.sms' },
  { key: 'lastCountWhatsapp', labelKey: 'segments.columns.whatsapp' },
];

export function ColumnVisibilityDialog({ visibility, onSave }: ColumnVisibilityDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnVisibility>(visibility);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft(visibility);
    setOpen(isOpen);
  };

  const handleToggle = (key: keyof ColumnVisibility) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title={t('segments.columns.customize')}>
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">{t('segments.columns.customize')}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('segments.columns.customizeTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-muted-foreground mb-3 text-sm">{t('segments.columns.channelReach')}</p>

          {CHANNEL_COLUMNS.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3">
                <GripVertical className="text-muted-foreground/50 h-4 w-4" />
                <span className="text-sm font-medium">{t(labelKey as never)}</span>
              </div>
              <Switch checked={draft[key]} onCheckedChange={() => handleToggle(key)} />
            </div>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t('common.cancel', 'Cancelar')}</Button>
          </DialogClose>
          <Button onClick={handleSave}>{t('common.save', 'Salvar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
