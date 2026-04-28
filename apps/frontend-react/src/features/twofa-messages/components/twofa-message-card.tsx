import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Pencil, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TwoFAMessageRef } from '../types';
import type { Message } from '@/features/messages/types';

export interface MessageStatistic {
  title: string;
  total: number;
  percentage: number;
}

interface TwoFAMessageCardProps {
  message: TwoFAMessageRef | null;
  percentage: number;
  availableMessages: Message[];
  statistics?: MessageStatistic[];
  onMessageChange: (message: TwoFAMessageRef | null) => void;
  onPercentageChange: (percentage: number) => void;
  onRemove: () => void;
  onEdit?: () => void;
  onPreview?: () => void;
}

export const TwoFAMessageCard = memo(function TwoFAMessageCard({
  message,
  percentage,
  availableMessages,
  statistics,
  onMessageChange,
  onPercentageChange,
  onRemove,
  onEdit,
  onPreview,
}: TwoFAMessageCardProps) {
  const { t } = useTranslation();

  const handleMessageSelect = (messageId: string) => {
    const selected = availableMessages.find((m) => m.id === Number(messageId));
    if (selected) {
      onMessageChange({
        id: selected.id,
        title: selected.title,
        subject: selected.subject,
        fromName: selected.fromName,
        url: selected.url,
      });
    }
  };

  const handlePercentageBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)));
    onPercentageChange(value);
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex-1 space-y-3">
          {message ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-primary flex-1 text-sm font-semibold">{message.title}</p>
                {onEdit && (
                  <Button variant="ghost" size="icon-xs" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onPreview && (
                  <Button variant="ghost" size="icon-xs" onClick={onPreview}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {message.subject && (
                <p className="text-muted-foreground text-xs">
                  {t('twofaMessages.title')}: {message.subject}
                </p>
              )}
              {message.fromName && <p className="text-muted-foreground text-xs">{message.fromName}</p>}
              {message.url && (
                <p className="text-muted-foreground max-w-[300px] truncate text-xs">Link: {message.url}</p>
              )}
            </div>
          ) : (
            <Select onValueChange={handleMessageSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('twofaMessages.chooseMessage')} />
              </SelectTrigger>
              <SelectContent>
                {availableMessages.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {message && (
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                {t('twofaMessages.sendPercentage')}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={percentage}
                onBlur={handlePercentageBlur}
                className="h-8 w-20 text-sm"
              />
            </div>
          )}

          {statistics && statistics.length > 0 && (
            <div className="flex gap-4 pt-1">
              {statistics.map((stat) => (
                <div key={stat.title} className="space-y-0.5">
                  <p className="text-muted-foreground text-[10px]">{stat.title}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-xs font-medium">{stat.total.toLocaleString()}</span>
                    {stat.percentage > 0 && (
                      <span className="text-muted-foreground text-[10px]">{stat.percentage}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
});
