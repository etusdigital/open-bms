import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { CampaignMessage, CampaignMessageType } from '../types';
import { useSearchMessages, type SearchableMessage } from '../use-campaign-messages';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';

interface MessageCardProps {
  message: CampaignMessage;
  messageType: CampaignMessageType;
  allMessages: CampaignMessage[];
  onSelect: (msg: SearchableMessage) => void;
  onRemove: () => void;
  index: number;
  label?: string;
}

export default function MessageCard({
  message,
  messageType,
  allMessages,
  onSelect,
  onRemove,
  index,
  label,
}: MessageCardProps) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const { data: searchResults = [] } = useSearchMessages({
    title: searchQuery,
    messageType,
  });

  const hasMessage = Boolean(message.id || message.messageId);

  if (!hasMessage) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-4" data-testid={`message-card-${index}`}>
        {label && <span className="text-muted-foreground text-xs font-medium">{label}</span>}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 font-normal"
              data-testid={`message-search-${index}`}
            >
              <Search className="h-4 w-4" />
              {t('campaigns.messageSearch')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t('campaigns.messageSearch')}
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>{t('common.noResults', 'Nenhum resultado.')}</CommandEmpty>
                <CommandGroup>
                  {searchResults.map((msg) => (
                    <CommandItem
                      key={msg.id}
                      value={String(msg.id)}
                      onSelect={() => {
                        onSelect(msg);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{msg.title}</span>
                        {msg.subject && <span className="text-muted-foreground text-xs">{msg.subject}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Display selected message
  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid={`message-card-${index}`}>
      {label && <span className="text-muted-foreground text-xs font-medium">{label}</span>}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{message.title || message.subject}</p>
          {message.subject && message.title && <p className="text-muted-foreground text-xs">{message.subject}</p>}
          {(message.fromName || message.fromMail) && (
            <p className="text-muted-foreground text-xs">
              {message.fromName}
              {message.fromMail && ` <${message.fromMail}>`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('campaigns.previewMessage')}
            onClick={() => setPreviewOpen(true)}
            data-testid={`message-preview-${index}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('campaigns.editMessage')}
            onClick={() => window.open(`/messages/${message.type || messageType}/${message.id}`, '_blank')}
            data-testid={`message-edit-${index}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive h-7 w-7"
            onClick={onRemove}
            title={t('campaigns.removeMessage')}
            data-testid={`message-remove-${index}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Statistics row */}
      {message.statistics && (
        <div className="text-muted-foreground flex gap-4 text-xs">
          {message.statistics.delivered !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {t('campaigns.messageDelivered')}: {message.statistics.delivered}
            </Badge>
          )}
          {message.statistics.openRate !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {t('campaigns.messageOpenRate')}: {message.statistics.openRate}%
            </Badge>
          )}
          {message.statistics.clickRate !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {t('campaigns.messageClickRate')}: {message.statistics.clickRate}%
            </Badge>
          )}
          {message.statistics.ctrOrRate !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {t('campaigns.messageCtrOrRate')}: {message.statistics.ctrOrRate}%
            </Badge>
          )}
        </div>
      )}

      {/* Preview dialog */}
      <MessagePreviewDialog
        messageIds={allMessages.filter((m) => m.id).map((m) => m.id as number)}
        initialIndex={index}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
