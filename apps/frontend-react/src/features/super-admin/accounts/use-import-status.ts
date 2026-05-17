import { useQuery } from '@tanstack/react-query';
import { importGateway, type ImportStatusResponse } from './import-gateway';

const POLL_INTERVAL_MS = 2000;

export function useImportStatus(jobId: string | undefined) {
  return useQuery<ImportStatusResponse>({
    queryKey: ['enterprise-import', jobId],
    queryFn: ({ signal }) => importGateway.getStatus(jobId as string, signal),
    enabled: !!jobId,
    // Polling stops at terminal states (completed/failed).
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}
