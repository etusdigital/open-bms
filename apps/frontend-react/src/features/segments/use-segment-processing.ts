import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

const POLL_INTERVAL = 3000;

/**
 * Manages segment processing state: tracks which segments are running,
 * polls the check endpoint, and refreshes data on completion.
 */
export function useSegmentProcessing() {
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<number>>(() => new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProcessing = useCallback((segmentId: number) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.add(segmentId);
      return next;
    });
  }, []);

  const stopProcessing = useCallback((segmentId: number) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(segmentId);
      return next;
    });
  }, []);

  const isProcessing = useCallback((segmentId: number) => processingIds.has(segmentId), [processingIds]);

  // Poll all processing segments
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (processingIds.size === 0) return;

    const checkAll = async () => {
      const ids = [...processingIds];
      for (const id of ids) {
        try {
          const { data } = await apiClient.get(`/tags/segment/check/${id}`);
          // API returns truthy (1) = still running, falsy (0/null) = finished
          if (!data) {
            stopProcessing(id);
            toast.success(i18n.t('segments.runFinished'));
            // Refresh the segments list to get updated counts
            queryClient.invalidateQueries({ queryKey: ['segments', 'list'] });
          }
        } catch {
          // Silently retry on error — don't remove from processing
        }
      }
    };

    intervalRef.current = setInterval(checkAll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [processingIds, stopProcessing, queryClient]);

  return { isProcessing, startProcessing, processingIds };
}
