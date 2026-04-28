import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch, Clock, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SplitNodeData, SplitPathNodeData, ConditionalTimeNodeData, ConditionalNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';

const PATH_LABELS = ['A', 'B', 'C', 'D', 'E'];

// ---------------------------------------------------------------------------
// Split Node — multiple source handles for each path
// ---------------------------------------------------------------------------

export const SplitNode = memo(function SplitNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as SplitNodeData;

  // Get path keys sorted: "1", "2", "3", etc.
  const paths = Object.keys(settings)
    .filter((k) => /^[1-5]$/.test(k))
    .sort();

  const pathCount = paths.length || 2;

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-amber-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />

      <div className="mb-2 flex items-center gap-2">
        <div className="rounded-md bg-amber-100 p-1.5">
          <GitBranch className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.conditions.split')}
          </p>
        </div>
      </div>

      {/* Path summary */}
      <div className="flex flex-wrap gap-2">
        {paths.map((key, i) => (
          <span key={key} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            {PATH_LABELS[i]}: {settings[key]}%
          </span>
        ))}
      </div>

      {/* Multiple source handles — spread across bottom */}
      {paths.map((key, i) => {
        const leftPercent = ((i + 1) / (pathCount + 1)) * 100;
        return (
          <Handle
            key={key}
            type="source"
            position={Position.Bottom}
            id={`path-${key}`}
            className="!bg-amber-400"
            style={{ left: `${leftPercent}%` }}
            isConnectable={false}
          />
        );
      })}

      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// SplitPath Node — branch entry label ("A: 50%")
// ---------------------------------------------------------------------------

export const SplitPathNode = memo(function SplitPathNode({ data, selected }: NodeProps) {
  const { settings } = data as SplitPathNodeData;

  const pathIndex = parseInt(settings.path, 10) - 1;
  const label = `${PATH_LABELS[pathIndex] ?? settings.path}: ${settings.value}%`;

  return (
    <div
      className={`min-w-[80px] rounded-md border bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold text-amber-700 transition-colors dark:bg-amber-950/30 dark:text-amber-400 ${
        selected ? 'border-primary ring-primary/20 ring-1' : 'border-amber-200 dark:border-amber-800'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400" isConnectable={false} />
      {label}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Conditional Node — Yes/No branches
// ---------------------------------------------------------------------------

export const ConditionalNode = memo(function ConditionalNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as ConditionalNodeData;

  const ruleCount = Array.isArray(settings) ? settings.length : 0;

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-orange-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-400" />

      <div className="flex items-center gap-2">
        <div className="rounded-md bg-orange-100 p-1.5">
          <HelpCircle className="h-4 w-4 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.conditions.conditional')}
          </p>
          <p className="text-muted-foreground text-xs">
            {ruleCount > 0
              ? t('automations.editor.conditions.rulesCount', { count: ruleCount })
              : t('automations.editor.conditions.noRules')}
          </p>
        </div>
      </div>

      {/* Two source handles: Yes (left) and No (right) — not draggable by user */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!bg-green-500"
        style={{ left: '33%' }}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!bg-gray-400"
        style={{ left: '66%' }}
        isConnectable={false}
      />

      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// ConditionalTrue Node — "Yes" branch label
// ---------------------------------------------------------------------------

export const ConditionalTrueNode = memo(function ConditionalTrueNode({ selected }: NodeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`min-w-[60px] rounded-md border bg-green-50 px-3 py-1.5 text-center text-xs font-semibold text-green-700 transition-colors dark:bg-green-950/30 dark:text-green-400 ${
        selected ? 'border-primary ring-primary/20 ring-1' : 'border-green-200 dark:border-green-800'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500" isConnectable={false} />
      <div className="flex items-center justify-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {t('automations.editor.conditions.yes')}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// ConditionalFalse Node — "No" branch label
// ---------------------------------------------------------------------------

export const ConditionalFalseNode = memo(function ConditionalFalseNode({ selected }: NodeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`min-w-[60px] rounded-md border bg-gray-50 px-3 py-1.5 text-center text-xs font-semibold text-gray-600 transition-colors dark:bg-gray-900/30 dark:text-gray-400 ${
        selected ? 'border-primary ring-primary/20 ring-1' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" isConnectable={false} />
      <div className="flex items-center justify-center gap-1">
        <XCircle className="h-3 w-3" />
        {t('automations.editor.conditions.no')}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// ConditionalTime Node — linear, time window
// ---------------------------------------------------------------------------

export const ConditionalTimeNode = memo(function ConditionalTimeNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as ConditionalTimeNodeData;

  const formatHour = (h: number | string) => {
    const hour = Number(h);
    return `${String(hour).padStart(2, '0')}:00`;
  };

  const hasConfig = settings.initialTime !== undefined && settings.endTime !== undefined;
  const label = hasConfig
    ? `${formatHour(settings.initialTime)} — ${formatHour(settings.endTime)}`
    : t('automations.editor.conditions.selectTimeRange');

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-yellow-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-yellow-100 p-1.5">
          <Clock className="h-4 w-4 text-yellow-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.conditions.conditionalTime')}
          </p>
          <p className="text-sm font-medium">{label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
