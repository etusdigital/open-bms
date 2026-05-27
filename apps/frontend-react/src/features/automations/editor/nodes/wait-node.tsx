import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WaitNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';

export const WaitNode = memo(function WaitNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as WaitNodeData;

  const label = `${settings.timer} ${t(`automations.editor.${settings.timerType}`)}`;

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-blue-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-blue-100 p-1.5">
          <Clock className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.wait')}
          </p>
          <p className="text-sm font-medium">{label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
