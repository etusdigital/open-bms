import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { HttpRequestNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';

export const HttpRequestNode = memo(function HttpRequestNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as HttpRequestNodeData;

  const method = settings.operation?.toUpperCase() ?? 'GET';
  const url = settings.url
    ? settings.url.length > 40
      ? `${settings.url.slice(0, 40)}...`
      : settings.url
    : t('automations.editor.http.noUrl');

  return (
    <div
      className={`group bg-card relative max-w-[280px] min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-indigo-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-indigo-100 p-1.5">
          <Globe className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t('automations.editor.http.title')}
            </p>
            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
              {method}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{url}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
