import { useTranslation } from 'react-i18next';
import {
  GripVertical,
  Mail,
  Bell,
  Smartphone,
  MessageSquare,
  Phone,
  Clock,
  CircleStop,
  FlaskConical,
  Shuffle,
  Tag,
  Tags,
  PenSquare,
  ArrowRightLeft,
  UserMinus,
  GitBranch,
  HelpCircle,
  Globe,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/stores/app-store';
import type { AccountChannels } from '@/types';

interface BlockItem {
  type: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Key in AccountChannels — if set, block is disabled when false */
  channelFlag?: keyof AccountChannels;
}

interface BlockCategory {
  labelKey: string;
  items: BlockItem[];
}

const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    labelKey: 'automations.editor.actions',
    items: [
      { type: 'email', labelKey: 'automations.editor.email', icon: Mail, channelFlag: 'email' },
      {
        type: 'webPush',
        labelKey: 'automations.editor.channels.webPush',
        icon: Bell,
        channelFlag: 'webPush',
      },
      {
        type: 'mobilePush',
        labelKey: 'automations.editor.channels.mobilePush',
        icon: Smartphone,
        channelFlag: 'mobilePush',
      },
      {
        type: 'sms',
        labelKey: 'automations.editor.channels.sms',
        icon: MessageSquare,
        channelFlag: 'sms',
      },
      {
        type: 'whatsapp',
        labelKey: 'automations.editor.channels.whatsapp',
        icon: Phone,
        channelFlag: 'whatsapp',
      },
      {
        type: 'testAB',
        labelKey: 'automations.editor.testAB.title',
        icon: FlaskConical,
        channelFlag: 'email',
      },
      {
        type: 'randomMessage',
        labelKey: 'automations.editor.randomMessage.title',
        icon: Shuffle,
        channelFlag: 'email',
      },
      {
        type: 'randomWebPush',
        labelKey: 'automations.editor.randomWebPush.title',
        icon: Shuffle,
        channelFlag: 'webPush',
      },
      {
        type: 'randomMobilePush',
        labelKey: 'automations.editor.randomMobilePush.title',
        icon: Shuffle,
        channelFlag: 'mobilePush',
      },
    ],
  },
  {
    labelKey: 'automations.editor.contactsCategory',
    items: [
      { type: 'addTag', labelKey: 'automations.editor.contacts.addTag', icon: Tag },
      { type: 'removeTag', labelKey: 'automations.editor.contacts.removeTag', icon: Tags },
      {
        type: 'updateCustomField',
        labelKey: 'automations.editor.contacts.updateCustomField',
        icon: PenSquare,
      },
      {
        type: 'contactTransfer',
        labelKey: 'automations.editor.contacts.contactTransfer',
        icon: ArrowRightLeft,
      },
      {
        type: 'removeAutomation',
        labelKey: 'automations.editor.contacts.removeAutomation',
        icon: UserMinus,
      },
    ],
  },
  {
    labelKey: 'automations.editor.timing',
    items: [
      { type: 'wait', labelKey: 'automations.editor.wait', icon: Clock },
      {
        type: 'conditionalTime',
        labelKey: 'automations.editor.conditions.conditionalTime',
        icon: Clock,
      },
    ],
  },
  {
    labelKey: 'automations.editor.logic',
    items: [
      { type: 'split', labelKey: 'automations.editor.conditions.split', icon: GitBranch },
      {
        type: 'conditional',
        labelKey: 'automations.editor.conditions.conditional',
        icon: HelpCircle,
      },
    ],
  },
  {
    labelKey: 'automations.editor.integrations',
    items: [{ type: 'httpRequest', labelKey: 'automations.editor.http.title', icon: Globe }],
  },
  {
    labelKey: 'automations.editor.other',
    items: [{ type: 'end', labelKey: 'automations.editor.end', icon: CircleStop }],
  },
];

function DraggableBlock({
  type,
  label,
  icon: Icon,
  disabled,
}: {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  const block = (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
        disabled
          ? 'bg-muted/30 cursor-not-allowed opacity-50'
          : 'bg-card hover:bg-accent cursor-grab active:cursor-grabbing'
      }`}
    >
      <GripVertical className={`h-4 w-4 shrink-0 ${disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
      <Icon className={`h-4 w-4 shrink-0 ${disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{block}</TooltipTrigger>
        <TooltipContent>{t('automations.editor.channelNotAvailable')}</TooltipContent>
      </Tooltip>
    );
  }

  return block;
}

export function BlocksSidebar() {
  const { t } = useTranslation();
  // Derive channels from configs — stable primitive selectors avoid infinite loop
  const channelEmail = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'email_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const channelWebPush = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'webpush_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const channelMobilePush = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'mobilepush_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const channelSms = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'sms_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const channelWhatsapp = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'whatsapp_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const channels: AccountChannels = {
    email: channelEmail,
    webPush: channelWebPush,
    mobilePush: channelMobilePush,
    sms: channelSms,
    whatsapp: channelWhatsapp,
  };
  return (
    <div className="bg-background flex min-h-0 w-[260px] shrink-0 flex-col overflow-hidden border-l">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('automations.editor.buildingBlocks')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {BLOCK_CATEGORIES.map((category, catIdx) => (
            <div key={category.labelKey}>
              {catIdx > 0 && <Separator className="mb-4" />}
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {t(category.labelKey as never)}
              </p>
              <div className="space-y-1.5">
                {category.items.map((item) => {
                    const disabled = item.channelFlag ? !channels[item.channelFlag] : false;

                    return (
                      <DraggableBlock
                        key={item.type}
                        type={item.type}
                        label={t(item.labelKey as never)}
                        icon={item.icon}
                        disabled={disabled}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
