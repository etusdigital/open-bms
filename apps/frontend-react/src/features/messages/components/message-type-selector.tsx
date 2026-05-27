import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Mail, Monitor, Smartphone, MessageSquare, Phone } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore, selectAccountChannels } from '@/stores/app-store';
import type { MessageType } from '../types';
import type { AccountChannels } from '@/types';

interface MessageTypeSelectorProps {
  value: MessageType;
  onChange: (type: MessageType) => void;
  disabled?: boolean;
}

const MESSAGE_TYPES: {
  type: MessageType;
  label: string;
  icon: typeof Mail;
  channelKey: keyof AccountChannels;
}[] = [
  { type: 'email', label: 'Email', icon: Mail, channelKey: 'email' },
  { type: 'web-push', label: 'Web Push', icon: Monitor, channelKey: 'webPush' },
  { type: 'mobile-push', label: 'Mobile Push', icon: Smartphone, channelKey: 'mobilePush' },
  { type: 'sms', label: 'SMS', icon: MessageSquare, channelKey: 'sms' },
  { type: 'whatsapp', label: 'WhatsApp', icon: Phone, channelKey: 'whatsapp' },
];

export function MessageTypeSelector({ value, onChange, disabled }: MessageTypeSelectorProps) {
  const { t } = useTranslation();
  const channels = useAppStore(useShallow(selectAccountChannels));

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-3">
        {MESSAGE_TYPES.map(({ type, label, icon: Icon, channelKey }) => {
          const isSelected = value === type;
          const isChannelDisabled = !channels[channelKey];
          const isButtonDisabled = disabled || isChannelDisabled;

          const button = (
            <button
              key={type}
              type="button"
              data-selected={isSelected}
              disabled={isButtonDisabled}
              onClick={() => {
                if (!isSelected) onChange(type);
              }}
              className={cn(
                'flex min-w-[120px] flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                isButtonDisabled && 'hover:border-border hover:text-muted-foreground cursor-not-allowed opacity-50',
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );

          if (isChannelDisabled && !disabled) {
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  {/* Wrap in span so tooltip works on disabled button */}
                  <span className="flex min-w-[120px] flex-1">{button}</span>
                </TooltipTrigger>
                <TooltipContent>{t('messages.channelNotConfigured')}</TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </TooltipProvider>
  );
}
