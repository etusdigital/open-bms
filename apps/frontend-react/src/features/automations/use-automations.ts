import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { AutomationsSearchParams } from '@/routes/_authenticated/_layout/automations/index';
import type { Automation } from './types';
import type { AutomationPayload } from './editor/types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function statusToIsActive(status?: string): string | undefined {
  if (status === 'active') return '1';
  if (status === 'inactive') return '0';
  return undefined; // 'all' — omit param so API returns both
}

async function fetchAutomationsList(
  params: AutomationsSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Automation>> {
  const isActive = statusToIsActive(params.status);
  const { data } = await apiClient.get<RawPaginatedResponse<Automation>>('/automations', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      type: 'email',
      ...(isActive != null && { isActive }),
      ...(params.search && { title: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useAutomationsList(params: AutomationsSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.automations.list(accountId, params),
    queryFn: ({ signal }) => fetchAutomationsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function useAutomationDetail(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery<Automation>({
    queryKey: queryKeys.automations.detail(accountId, id),
    queryFn: async () => {
      const { data } = await apiClient.get<Automation>(`/automations/${id}`);
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Message Statistics (per-step)
// ---------------------------------------------------------------------------

export interface MessageStepStats {
  [key: string]: number;
  message_id: number;
  delivered: number;
  open: number;
  unique_open: number;
  click: number;
  unique_click: number;
  unsubscribe: number;
  bounce: number;
  sent: number;
  close: number;
}

export function useMessageStatistics(
  automationId: number,
  emailIds: number[],
  webPushIds: number[],
  mobilePushIds: number[],
  daysFilter: number,
) {
  const auth = useAppStore((s) => s.auth);

  return useQuery<Record<string, MessageStepStats>>({
    queryKey: queryKeys.automations.messageStats(automationId, emailIds, webPushIds, mobilePushIds, daysFilter),
    queryFn: async () => {
      const tzoffset = new Date().getTimezoneOffset() * 60000;
      const now = new Date(Date.now() - tzoffset);
      const start = new Date(Date.now() - tzoffset);
      start.setDate(start.getDate() - daysFilter);

      const startDate = start.toISOString().slice(0, 10);
      const endDate = daysFilter === 1 ? startDate : now.toISOString().slice(0, 10);

      const { data } = await apiClient.get('/statistics/messages', {
        params: {
          email: emailIds,
          webPush: webPushIds,
          mobilePush: mobilePushIds,
          startDate,
          endDate,
          automationId,
        },
      });
      return data ?? {};
    },
    enabled:
      auth.status === 'authenticated' &&
      automationId > 0 &&
      (emailIds.length > 0 || webPushIds.length > 0 || mobilePushIds.length > 0),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Automation Statistics (KPI cards)
// ---------------------------------------------------------------------------

export interface AutomationStats {
  unique_open: number;
  unique_click: number;
  total_running: number;
  total_running_today: number;
}

export function useAutomationStatistics(automationId: number) {
  const auth = useAppStore((s) => s.auth);
  return useQuery<AutomationStats>({
    queryKey: queryKeys.automations.stats(automationId),
    queryFn: async () => {
      const { data } = await apiClient.get<AutomationStats[]>(`/statistics/automation/${automationId}`);
      return Array.isArray(data) && data.length > 0
        ? data[0]
        : { unique_open: 0, unique_click: 0, total_running: 0, total_running_today: 0 };
    },
    enabled: auth.status === 'authenticated' && automationId > 0,
    staleTime: 30_000,
  });
}

export interface GoalStatPoint {
  date: string;
  count: number;
}

export function useAutomationGoalStats(automationId: number, startDate: string, endDate: string) {
  const auth = useAppStore((s) => s.auth);
  return useQuery<GoalStatPoint[]>({
    queryKey: queryKeys.automations.goalStats(automationId, startDate, endDate),
    queryFn: async () => {
      const { data } = await apiClient.get<GoalStatPoint[]>('/automations/target/statistics', {
        params: { automationId, startDate, endDate },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: auth.status === 'authenticated' && automationId > 0 && !!startDate && !!endDate,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Audits (version history)
// ---------------------------------------------------------------------------

export interface AuditRecord {
  id: number;
  entityId: number;
  type: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  user: string;
  userName?: string;
  userEmail?: string;
  createdAt: string;
}

export function useAutomationAudits(automationId: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery<AuditRecord[]>({
    queryKey: queryKeys.automations.audits(automationId),
    queryFn: async () => {
      const { data } = await apiClient.get<AuditRecord[]>(`/audits/${automationId}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: auth.status === 'authenticated' && automationId > 0,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function useCreateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AutomationPayload) => {
      const { data } = await apiClient.post<Automation>('/automations/complete', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('automations.createError'));
    },
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AutomationPayload) => {
      const { data } = await apiClient.put<Automation>('/automations/complete', payload);
      return data;
    },
    onSuccess: (_data, _variables) => {
      queryClient.removeQueries({ queryKey: [...queryKeys.automations.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('automations.updateError'));
    },
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('automations.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('automations.entityName') }),
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export function useDuplicateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Automation>(`/automations/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
      toast.success(i18n.t('automations.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('automations.duplicateError'));
    },
  });
}

// ---------------------------------------------------------------------------
// Toggle active/inactive
// ---------------------------------------------------------------------------

export function useToggleAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiClient.patch(`/automations/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('automations.toggleError'));
    },
  });
}
