import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { UnsupportedNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';

export const UnsupportedNode = memo(function UnsupportedNode({ id, data, selected }: NodeProps) {
  const { originalType } = data as UnsupportedNodeData;

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 border-dashed p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-yellow-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-yellow-100 p-1.5">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{originalType}</p>
          <p className="text-muted-foreground text-xs">Not editable in this version</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
