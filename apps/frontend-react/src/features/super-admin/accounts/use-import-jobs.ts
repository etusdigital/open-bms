import { useQuery } from '@tanstack/react-query';
import { importGateway, type ImportStatusResponse } from './import-gateway';

/**
 * Lists recent enterprise-import jobs (most-recent-first). Re-fetches every
 * 10s so running jobs surface their progress on the dashboard without
 * forcing the operator to open the detail page.
 */
export function useImportJobs() {
  return useQuery<ImportStatusResponse[]>({
    queryKey: ['enterprise-import', 'list'],
    queryFn: ({ signal }) => importGateway.listJobs(signal),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
