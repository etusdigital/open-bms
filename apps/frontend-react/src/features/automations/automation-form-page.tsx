import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  X,
  Pencil,
  Save,
  Loader2,
  ChevronDown,
  Rocket,
  Pause,
  History,
  RotateCcw,
  ArrowLeft,
  BarChart3,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';

import { useAppStore } from '@/stores/app-store';
import { AutomationEditor } from './editor/automation-editor';
import { BlocksSidebar } from './editor/panels/blocks-sidebar';
import { AutomationDetailsModal, type AutomationMetadata } from './editor/panels/automation-details-modal';
import { VersionHistoryPanel } from './editor/panels/version-history-panel';
import { AutomationStatisticsDialog } from './editor/panels/automation-statistics-dialog';
import { deserializeWithLayout, serializeFlowToSteps, buildFlowLayout } from './editor/editor-serializer';
import {
  useAutomationDetail,
  useCreateAutomation,
  useUpdateAutomation,
  useToggleAutomation,
  useAutomationAudits,
  useMessageStatistics,
  type AuditRecord,
} from './use-automations';
import { collectMessageIds } from './editor/collect-message-ids';
import type {
  AutomationNode,
  AutomationEdge,
  AutomationPayload,
  AutomationEditorHandle,
  TriggerSettings,
} from './editor/types';
import { NODE_SPACING } from './editor/types';
import type { ApiStep, FlowLayout } from './editor/types';

// ---------------------------------------------------------------------------
// Default empty automation (trigger + end)
// ---------------------------------------------------------------------------

function createEmptyFlow(): {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  stepIdCounter: number;
} {
  return {
    nodes: [
      {
        id: '1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { stepId: 1, settings: {} as TriggerSettings },
      },
      {
        id: '2',
        type: 'end',
        position: { x: 250, y: 50 + NODE_SPACING },
        data: { stepId: 2, settings: {} as Record<string, never> },
      },
    ],
    edges: [{ id: 'e1-2', source: '1', target: '2', type: 'smoothstep' }],
    stepIdCounter: 3,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AutomationFormPageProps {
  automationId?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AutomationFormPage({ automationId }: AutomationFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = !!automationId;

  // Ref to read live editor state
  const editorRef = useRef<AutomationEditorHandle>(null);

  // Fetch existing automation
  const { data: automation, isLoading } = useAutomationDetail(automationId ?? 0);

  // Mutations
  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const toggleMutation = useToggleAutomation();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Metadata state
  const [metadata, setMetadata] = useState<AutomationMetadata>({
    title: '',
    description: '',
    verticalType: 'cc',
    target: '',
    isRateLimit: false,
    labels: [],
  });
  const [isActive, setIsActive] = useState(false);
  const [_isDirty, setIsDirty] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Statistics + history state
  const [statsOpen, setStatsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isInternal = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.isInternal : false));
  const [previewAudit, setPreviewAudit] = useState<AuditRecord | null>(null);
  const { data: audits = [], isLoading: auditsLoading } = useAutomationAudits(automationId ?? 0);

  // Deserialize automation on load (synchronous, no flash)
  const initialEditorState = useMemo(() => {
    if (isEditing && automation?.steps) {
      return deserializeWithLayout(automation.steps!, automation.flowLayout);
    }
    return null;
  }, [isEditing, automation]);

  // Hydrate form fields once
  const [hydrated, setHydrated] = useState(false);
  if (automation && !hydrated) {
    setMetadata({
      title: automation.title ?? '',
      description: automation.description ?? '',
      verticalType: automation.verticalType ?? 'cc',
      target: automation.target ?? '',
      isRateLimit: automation.isRateLimit ?? false,
      labels: automation.labels ?? [],
    });
    setIsActive(automation.isActive ?? false);
    setHydrated(true);
  }

  // For create mode, use empty flow
  const emptyFlow = useMemo(() => createEmptyFlow(), []);
  const effectiveInitialNodes = initialEditorState?.nodes ?? emptyFlow.nodes;
  const effectiveInitialEdges = initialEditorState?.edges ?? emptyFlow.edges;
  const effectiveStepIdCounter = initialEditorState ? initialEditorState.maxStepId + 1 : emptyFlow.stepIdCounter;
  const effectiveViewport = automation?.flowLayout?.viewport;

  // Message statistics
  const [statsDaysFilter, setStatsDaysFilter] = useState(0); // 0=Today
  const { emailIds, webPushIds, mobilePushIds } = useMemo(
    () => collectMessageIds(effectiveInitialNodes),
    [effectiveInitialNodes],
  );
  const { data: messageStats = {} } = useMessageStatistics(
    automationId ?? 0,
    emailIds,
    webPushIds,
    mobilePushIds,
    statsDaysFilter,
  );

  // Preview mode: deserialize the historic version's steps
  const isPreviewMode = previewAudit !== null;
  const previewEditorState = useMemo(() => {
    if (!previewAudit?.newValues?.steps) return null;
    return deserializeWithLayout(
      previewAudit.newValues.steps as ApiStep,
      (previewAudit.newValues.flowLayout as FlowLayout | null) ?? null,
    );
  }, [previewAudit]);

  const handleSelectVersion = useCallback((audit: AuditRecord, isCurrentVersion: boolean) => {
    if (isCurrentVersion) {
      setPreviewAudit(null); // back to live
    } else {
      setPreviewAudit(audit);
    }
  }, []);

  const handleRestoreVersion = useCallback(() => {
    if (!previewAudit?.newValues?.steps || savingRef.current) return;
    // Use the preview state for save
    const result = serializeFlowToSteps(previewEditorState?.nodes ?? [], previewEditorState?.edges ?? []);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    // Build the flow layout from the previewed version's nodes/edges
    const restoredLayout = previewEditorState
      ? buildFlowLayout(previewEditorState.nodes, previewEditorState.edges)
      : null;

    const payload: AutomationPayload = {
      id: automationId,
      title: metadata.title.trim(),
      description: metadata.description.trim() || undefined,
      type: 'email',
      isActive,
      isRateLimit: metadata.isRateLimit,
      stepId: previewEditorState?.maxStepId ? previewEditorState.maxStepId + 1 : 3,
      steps: result.root,
      verticalType: metadata.verticalType || undefined,
      target: metadata.target || undefined,
      labels: metadata.labels,
      flowLayout: restoredLayout,
    };

    savingRef.current = true;
    updateMutation.mutate(payload, {
      onSuccess: (data: any) => {
        if (data?.messageError) {
          toast.error(t(`automations.errors.${data.messageError}`, data.messageError));
          return;
        }
        setPreviewAudit(null);
        setHydrated(false);
        setIsDirty(false);
        toast.success(t('automations.editor.history.restoreSuccess'));
      },
      onSettled: () => {
        savingRef.current = false;
      },
    });
  }, [previewAudit, previewEditorState, automationId, metadata, isActive, updateMutation, t]);

  // Last saved time
  const lastSavedText = automation?.updatedAt
    ? formatDistanceToNow(new Date(automation.updatedAt), {
        addSuffix: true,
        locale: i18n.language === 'pt-BR' ? ptBR : enUS,
      })
    : null;

  // ---------------------------------------------------------------------------
  // Toggle active/inactive
  // ---------------------------------------------------------------------------

  const _handleToggleActive = useCallback(() => {
    const newActive = !isActive;
    setIsActive(newActive);
    setIsDirty(true);

    // If editing, also persist the toggle immediately
    if (automationId) {
      toggleMutation.mutate({ id: automationId, isActive: newActive });
    }
  }, [isActive, automationId, toggleMutation]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const savingRef = useRef(false);
  const handleSave = useCallback(
    (activeOverride?: boolean) => {
      if (savingRef.current) return;
      const saveIsActive = activeOverride !== undefined ? activeOverride : isActive;
      if (!metadata.title.trim()) {
        toast.error(t('automations.editor.titleRequired'));
        setDetailsModalOpen(true);
        return;
      }

      // Read LIVE state from the editor ref
      const state = editorRef.current?.getState();
      if (!state) {
        toast.error('Editor state not available');
        return;
      }

      // Validate: every node must be reachable (has an incoming edge or is the trigger)
      const targetIds = new Set(state.edges.map((e) => e.target));
      const disconnected = state.nodes.find((n) => n.type !== 'trigger' && !targetIds.has(n.id));
      if (disconnected) {
        toast.error(t('automations.editor.disconnectedNode'));
        editorRef.current?.highlightError(Number(disconnected.id) || 0);
        return;
      }

      // Serialize to API tree format
      const result = serializeFlowToSteps(state.nodes, state.edges);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Build flow layout for persistence
      const flowLayout = buildFlowLayout(state.nodes, state.edges, state.viewport);

      const payload: AutomationPayload = {
        ...(automationId && { id: automationId }),
        title: metadata.title.trim(),
        description: metadata.description.trim() || undefined,
        type: 'email',
        isActive: saveIsActive,
        isRateLimit: metadata.isRateLimit,
        stepId: state.stepIdCounter,
        steps: result.root,
        verticalType: metadata.verticalType || undefined,
        target: metadata.target || undefined,
        labels: metadata.labels,
        flowLayout,
      };

      // Clear previous error
      editorRef.current?.clearError();

      const handleResponse = (data: any) => {
        // API returns 200/201 with { messageError, stepError } on validation failure
        if (data?.messageError) {
          const errorMsg = t(`automations.errors.${data.messageError}`, data.messageError);
          toast.error(errorMsg);
          if (data.stepError !== undefined && data.stepError !== null) {
            editorRef.current?.highlightError(data.stepError);
          }
          return true; // had error
        }
        return false;
      };

      savingRef.current = true;

      const onSettled = () => {
        savingRef.current = false;
      };

      if (isEditing) {
        updateMutation.mutate(payload, {
          onSuccess: (data) => {
            if (handleResponse(data)) return;
            setIsActive(saveIsActive);
            setIsDirty(false);
            toast.success(saveIsActive ? t('automations.editor.publishSuccess') : t('automations.updateSuccess'));
          },
          onSettled,
        });
      } else {
        createMutation.mutate(payload, {
          onSuccess: (data) => {
            if (handleResponse(data)) return;
            setIsActive(saveIsActive);
            setIsDirty(false);
            toast.success(saveIsActive ? t('automations.editor.publishSuccess') : t('automations.createSuccess'));
            navigate({
              to: '/automations/$automationId',
              params: { automationId: String(data.id) },
            });
          },
          onSettled,
        });
      }
    },
    [metadata, isActive, automationId, isEditing, createMutation, updateMutation, navigate, t],
  );

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isEditing && isLoading) {
    return (
      <div className="layout-full-bleed flex h-full min-h-[900px] flex-col">
        <div className="flex h-12 items-center gap-4 border-b px-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="layout-full-bleed flex h-full min-h-[900px] flex-col">
      {/* Compact top bar */}
      <div className="bg-background flex h-12 shrink-0 items-center gap-3 border-b px-4">
        {/* Close */}
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/automations" search={{} as never}>
            <X className="h-4 w-4" />
          </Link>
        </Button>

        {/* Status badge (non-interactive) */}
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? t('automations.active') : t('automations.editor.draft')}
        </Badge>

        {/* Automation name + edit button */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{metadata.title || t('automations.editor.untitled')}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setDetailsModalOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last saved */}
        {lastSavedText && !isPreviewMode && (
          <span className="text-muted-foreground hidden text-xs sm:block">
            {t('automations.editor.lastSaved', { time: lastSavedText })}
          </span>
        )}

        {/* Stats date range (only when editing) */}
        {isEditing && !isPreviewMode && (
          <select
            value={statsDaysFilter}
            onChange={(e) => setStatsDaysFilter(Number(e.target.value))}
            className="bg-background text-muted-foreground h-7 rounded-md border px-2 text-xs"
          >
            <option value={0}>{t('automations.editor.statsRange.today')}</option>
            <option value={1}>{t('automations.editor.statsRange.yesterday')}</option>
            <option value={7}>{t('automations.editor.statsRange.last7')}</option>
            <option value={30}>{t('automations.editor.statsRange.last30')}</option>
          </select>
        )}

        {/* Statistics button (internal accounts only, edit mode) */}
        {isEditing && !isPreviewMode && isInternal && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={() => setStatsOpen(true)}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('automations.editor.stats.button')}</span>
          </Button>
        )}

        {/* History button (only when editing) */}
        {isEditing && !isPreviewMode && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">{t('automations.editor.history.title')}</span>
          </Button>
        )}

        {/* Save split button */}
        <div className="flex items-center">
          <Button size="sm" className="rounded-r-none" onClick={() => handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {t('common.save')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="border-primary-foreground/20 rounded-l-none border-l px-2"
                disabled={isSaving}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isActive ? (
                <DropdownMenuItem onClick={() => handleSave(true)} className="gap-2">
                  <Rocket className="h-4 w-4" />
                  {t('automations.editor.saveAndPublish')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleSave(false)} className="text-destructive gap-2">
                  <Pause className="h-4 w-4" />
                  {t('automations.editor.saveAndDeactivate')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Preview banner */}
      {isPreviewMode && (
        <div className="flex h-10 shrink-0 items-center justify-center gap-3 border-b bg-amber-50 px-4 dark:bg-amber-950/30">
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {t('automations.editor.history.previewBanner', {
              date: previewAudit?.createdAt
                ? new Date(previewAudit.createdAt).toLocaleDateString(i18n.language, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '',
            })}
          </span>
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5 text-xs"
            onClick={handleRestoreVersion}
            disabled={isSaving}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('automations.editor.history.restore')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setPreviewAudit(null)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('automations.editor.history.backToCurrent')}
          </Button>
        </div>
      )}

      {/* Main content: editor + sidebar */}
      <div className="flex min-h-0 flex-1">
        {/* Editor canvas */}
        <div className="min-w-0 flex-1">
          {isPreviewMode && previewEditorState ? (
            <AutomationEditor
              key={`preview-${previewAudit?.id}`}
              initialNodes={previewEditorState.nodes}
              initialEdges={previewEditorState.edges}
              initialStepIdCounter={previewEditorState.maxStepId + 1}
              onDirtyChange={() => {}}
              readOnly={true}
            />
          ) : (
            <AutomationEditor
              ref={editorRef}
              key={`${automationId ?? 'new'}-${automation?.updatedAt ?? ''}`}
              initialNodes={effectiveInitialNodes}
              initialEdges={effectiveInitialEdges}
              initialStepIdCounter={effectiveStepIdCounter}
              initialViewport={effectiveViewport}
              onDirtyChange={setIsDirty}
              readOnly={false}
              messageStats={messageStats}
            />
          )}
        </div>

        {/* Blocks sidebar (hidden in preview mode) */}
        {!isPreviewMode && <BlocksSidebar />}
      </div>

      {/* Metadata modal */}
      <AutomationDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        metadata={metadata}
        onSave={(updated) => {
          setMetadata(updated);
          setIsDirty(true);
        }}
      />

      {/* Statistics dialog */}
      {isEditing && automationId && (
        <AutomationStatisticsDialog open={statsOpen} onOpenChange={setStatsOpen} automationId={automationId} />
      )}

      {/* Version history panel */}
      {isEditing && (
        <VersionHistoryPanel
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          audits={audits}
          isLoading={auditsLoading}
          selectedAuditId={previewAudit?.id ?? null}
          onSelectVersion={handleSelectVersion}
        />
      )}
    </div>
  );
}
