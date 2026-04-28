import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CircleStop } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from './node-delete-button';

export const EndNode = memo(function EndNode({ id, selected }: NodeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-gray-100 p-1.5">
          <CircleStop className="h-4 w-4 text-gray-500" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">{t('automations.editor.end')}</p>
      </div>
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
