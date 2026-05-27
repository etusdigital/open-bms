import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GenerateLinksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateLinksModal({ open, onOpenChange }: GenerateLinksModalProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<string[]>(['']);

  const handleAddLink = useCallback(() => {
    setLinks((prev) => [...prev, '']);
  }, []);

  const handleRemoveLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLinkChange = useCallback((index: number, value: string) => {
    setLinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleCopyLinks = useCallback(async () => {
    const nonEmpty = links.filter((l) => l.trim() !== '');
    if (nonEmpty.length === 0) {
      toast.error(t('messages.generateLinksEmpty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(nonEmpty));
      toast.success(t('messages.generateLinksCopied'));
    } catch {
      toast.error(t('messages.generateLinksCopyError'));
    }
  }, [links, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messages.generateLinks')}</DialogTitle>
          <DialogDescription className="sr-only">{t('messages.generateLinks')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] space-y-2 overflow-y-auto">
          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={link}
                onChange={(e) => handleLinkChange(index, e.target.value)}
                placeholder={t('messages.generateLinksPlaceholder')}
                data-testid={`link-input-${index}`}
              />
              {links.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
                  onClick={() => handleRemoveLink(index)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={handleAddLink}>
            <Plus className="mr-1 h-4 w-4" />
            {t('common.add')}
          </Button>
          <Button type="button" variant="default" size="sm" onClick={handleCopyLinks}>
            <Copy className="mr-1 h-4 w-4" />
            {t('messages.generateLinksCopy')}
          </Button>
        </div>

        {/* Preview of JSON output */}
        <div className="bg-muted rounded-md p-3">
          <p className="text-muted-foreground mb-1 text-xs font-medium">JSON</p>
          <code className="text-xs break-all">{JSON.stringify(links.filter((l) => l.trim() !== ''))}</code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
