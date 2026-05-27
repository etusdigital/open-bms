import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Segment } from './types';
import type { SegmentFormValues } from './segment-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchSegmentsList(
  params: ListSearchParams,
  status?: string,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Segment>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Segment>>('/tags', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      type: 'segment',
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
      ...(status && { status }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useSegmentsList(params: ListSearchParams, status?: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.segments.list(accountId, params), status],
    queryFn: ({ signal }) => fetchSegmentsList(params, status, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useSegment(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.segments.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Segment>(`/tags/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SegmentFormValues) => {
      const { data: result } = await apiClient.post<Segment>('/tags/segment', {
        ...data,
        type: 'segment',
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('segments.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('segments.entityName') }),
      );
    },
  });
}

export function useUpdateSegment(id: number) {
  const queryClient = useQueryClient();
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useMutation({
    mutationFn: async (data: SegmentFormValues) => {
      const { data: result } = await apiClient.put<Segment>(`/tags/segment/${id}`, {
        ...data,
        type: 'segment',
      });
      return result;
    },
    onSuccess: () => {
      // Remove the detail from cache so next visit fetches fresh data.
      // Invalidate only list queries (not detail) to avoid a refetch
      // that gets cancelled by the post-update navigation.
      queryClient.removeQueries({ queryKey: queryKeys.segments.detail(accountId, id) });
      queryClient.invalidateQueries({ queryKey: ['segments', 'list'] });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('segments.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('segments.entityName') }),
      );
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('segments.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('segments.entityName') }),
      );
    },
  });
}

export function useCopySegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Segment>(`/tags/segment/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all });
      toast.success(i18n.t('segments.copySuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('segments.copyError'));
    },
  });
}

export function useRunSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.get<Segment>(`/tags/segment/run/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all });
      toast.success(i18n.t('segments.runSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('segments.runError'));
    },
  });
}

/**
 * Polls segment processing status every 5 seconds.
 * Uses TanStack Query's refetchInterval — auto-stops on unmount.
 * Pauses when tab is hidden (refetchIntervalInBackground: false).
 */
export function useSegmentProcessingStatus(segmentId: number, isProcessing: boolean) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['segment-processing', segmentId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Segment>(`/tags/segment/check/${segmentId}`, { signal });
      return data;
    },
    enabled: isProcessing && segmentId > 0,
    refetchInterval: (query) => {
      if (query.state.data?.hasFinishedProcessing) {
        queryClient.invalidateQueries({ queryKey: queryKeys.segments.all });
        return false;
      }
      return 5000;
    },
    refetchIntervalInBackground: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}
