import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Tag, Tags, PenSquare, ArrowRightLeft, UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type {
  TagNodeData,
  UpdateCustomFieldNodeData,
  ContactTransferNodeData,
  RemoveAutomationNodeData,
} from '../types';
import { NodeDeleteButton } from './node-delete-button';

// ---------------------------------------------------------------------------
// Add Tag
// ---------------------------------------------------------------------------

export const AddTagNode = memo(function AddTagNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as TagNodeData;
  const tags = Array.isArray(settings) ? settings : settings ? [settings] : [];

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-green-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-green-100 p-1.5">
          <Tag className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.contacts.addTag')}
          </p>
          {tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">{t('automations.editor.contacts.selectTags')}</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Remove Tag
// ---------------------------------------------------------------------------

export const RemoveTagNode = memo(function RemoveTagNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as TagNodeData;
  const tags = Array.isArray(settings) ? settings : settings ? [settings] : [];

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-orange-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-orange-100 p-1.5">
          <Tags className="h-4 w-4 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.contacts.removeTag')}
          </p>
          {tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">{t('automations.editor.contacts.selectTags')}</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Update Custom Field
// ---------------------------------------------------------------------------

export const UpdateCustomFieldNode = memo(function UpdateCustomFieldNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as UpdateCustomFieldNodeData;

  const hasConfig = settings.customFieldSelected?.title;
  const label = hasConfig
    ? `${settings.customFieldSelected.title} = ${settings.customFieldValue}`
    : t('automations.editor.contacts.selectField');

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-blue-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-blue-100 p-1.5">
          <PenSquare className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.contacts.updateCustomField')}
          </p>
          <p className="truncate text-sm font-medium">{label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Contact Transfer (internal only)
// ---------------------------------------------------------------------------

export const ContactTransferNode = memo(function ContactTransferNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as ContactTransferNodeData;

  const label = settings.accountName ? `→ ${settings.accountName}` : t('automations.editor.contacts.selectAccount');

  return (
    <div
      className={`group bg-card relative min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-violet-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-violet-100 p-1.5">
          <ArrowRightLeft className="h-4 w-4 text-violet-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.contacts.contactTransfer')}
          </p>
          <p className="truncate text-sm font-medium">{label}</p>
          {settings.tagName && <p className="text-muted-foreground text-xs">Tag: {settings.tagName}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Remove Automation (internal only)
// ---------------------------------------------------------------------------

export const RemoveAutomationNode = memo(function RemoveAutomationNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const { settings } = data as RemoveAutomationNodeData;

  const automations = settings.automations ?? [];

  return (
    <div
      className={`group bg-card relative max-w-[280px] min-w-[220px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-red-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-400" />
      <div className="mb-1 flex items-center gap-2">
        <div className="rounded-md bg-red-100 p-1.5">
          <UserMinus className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.contacts.removeAutomation')}
          </p>
        </div>
      </div>
      {automations.length > 0 ? (
        <div className="ml-9 space-y-0.5">
          {automations.slice(0, 3).map((a) => (
            <p key={a.id} className="truncate text-xs">
              {a.title}
            </p>
          ))}
          {automations.length > 3 && <p className="text-muted-foreground text-xs">+{automations.length - 3}</p>}
        </div>
      ) : (
        <p className="text-muted-foreground ml-9 text-xs">{t('automations.editor.contacts.selectAutomations')}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-red-400" />
      <NodeDeleteButton nodeId={id} />
    </div>
  );
});
