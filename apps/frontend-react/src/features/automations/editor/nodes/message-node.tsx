import { memo, useState, type ComponentType } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MessageNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';
import { StatTiles } from './stat-tiles';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';

interface MessageNodeConfig {
  labelKey: string;
  /** Channel key used for stat tile selection (e.g., 'email', 'webPush', 'mobilePush') */
  channelKey?: string;
  icon: ComponentType<{ className?: string }>;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  handleColor: string;
}

export function createMessageNode(config: MessageNodeConfig) {
  const { labelKey, channelKey, icon: Icon, borderColor, iconBg, iconColor, handleColor } = config;

  return memo(function MessageNode({ id, data, selected }: NodeProps) {
    const { t } = useTranslation();
    const { settings } = data as MessageNodeData;
    const [previewOpen, setPreviewOpen] = useState(false);

    const title = settings.title || settings.name || t('automations.editor.selectMessage');
    const messageId = settings.id;

    return (
      <div
        className={`group bg-card relative max-w-[300px] min-w-[240px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
          selected ? 'border-primary ring-primary/20 ring-2' : borderColor
        }`}
      >
        <Handle type="target" position={Position.Top} className={handleColor} />
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t(labelKey as never)}
            </p>
            <p className="truncate text-sm font-medium">{title}</p>
            {settings.subject && <p className="text-muted-foreground truncate text-xs">{settings.subject}</p>}
          </div>
          {messageId ? (
            <button
              type="button"
              className="nodrag text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOpen(true);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {messageId ? <StatTiles messageId={messageId} channelType={channelKey} /> : null}
        <Handle type="source" position={Position.Bottom} className={handleColor} />
        <NodeDeleteButton nodeId={id} />

        {messageId && previewOpen ? (
          <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <MessagePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} messageIds={[messageId]} />
          </div>
        ) : null}
      </div>
    );
  });
}
