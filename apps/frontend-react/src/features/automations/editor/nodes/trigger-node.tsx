import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TriggerNodeData } from '../types';

const TYPE_LABEL_KEYS: Record<string, string> = {
  tag: 'automations.editor.trigger.typeTag',
  events: 'automations.editor.trigger.typeEvents',
  custom_events: 'automations.editor.trigger.typeCustomEvents',
  'web-push': 'automations.editor.trigger.typeWebPush',
  'mobile-push': 'automations.editor.trigger.typeMobilePush',
};

export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as TriggerNodeData;

  let label: string;
  if (!settings.type) {
    label = t('automations.editor.addTrigger');
  } else if (settings.type === 'tag') {
    label = `${t('automations.editor.trigger.typeTag')}: ${settings.name ?? ''}`;
  } else if (settings.type === 'events') {
    const eventLabel = settings.eventType
      ? t(
          `automations.editor.trigger.event${settings.eventType.charAt(0).toUpperCase()}${settings.eventType.slice(1)}`,
          settings.eventType,
        )
      : '';
    label = `${t('automations.editor.trigger.typeEvents')}: ${eventLabel}`;
  } else if (settings.type === 'custom_events') {
    label = `${t('automations.editor.trigger.typeCustomEvents')}: ${settings.name ?? ''}`;
  } else {
    label = t((TYPE_LABEL_KEYS[settings.type] ?? 'automations.editor.addTrigger') as never);
  }

  return (
    <div
      className={`bg-card min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-orange-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-orange-100 p-1.5">
          <Zap className="h-4 w-4 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.triggerLabel')}
          </p>
          <p className="truncate text-sm font-medium">{label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400" />
    </div>
  );
});
