import axios from 'axios';
import type {
  AdvanceStepInput,
  GeoIpSetupData,
  S3SetupData,
  HealthCheckResult,
  SetupStatus,
  Step1Data,
  Step2Data,
} from './setup.types';

/**
 * Isolated axios instance for the setup wizard.
 *
 * The wizard runs BEFORE auth — endpoints are `@PublicRoute()` on the backend
 * and there's no signed-in user yet (except mid-flow after Step 1's auto-login).
 * Using the global `apiClient` here would attach the auth interceptors and
 * trigger a `/login` redirect on any 401, breaking the wizard. So we keep a
 * dedicated client with NO interceptors.
 */
const baseURL = import.meta.env.VITE_API_URL || '/api';

const http = axios.create({ baseURL });

export const setupGateway = {
  async getStatus(): Promise<SetupStatus> {
    const res = await http.get<SetupStatus>('/setup/status');
    return res.data;
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const res = await http.get<HealthCheckResult>('/setup/health-check');
    return res.data;
  },

  async advanceStep(input: AdvanceStepInput): Promise<void> {
    await http.post('/setup/advance', input);
  },

  async testSmtp(data: Step2Data): Promise<void> {
    await http.post('/setup/test-smtp', data);
  },

  async submitGeoIp(data: GeoIpSetupData): Promise<void> {
    await http.post('/setup/geoip', data);
  },

  async submitS3(data: S3SetupData): Promise<void> {
    await http.post('/setup/s3', data);
  },

  // Account-scoped wizard step. Creates a new account and imports into it;
  // returns {jobId} for the UI to monitor progress.
  async importEnterprise(
    payload:
      | { skip: true }
      | {
          baseUrl: string;
          apiKey: string;
          accountName?: string;
          useStep1Account?: boolean;
          enterpriseSourceAccountId?: number;
        },
  ): Promise<{ jobId?: string }> {
    const res = await http.post<{ jobId?: string }>('/setup/import-enterprise', payload);
    return res.data;
  },

  // Resets the import environment (stops the queue, deletes import jobs/accounts).
  // Called when (re)opening Step 2 to always start from scratch. Idempotent.
  async resetEnterpriseImport(): Promise<void> {
    await http.post('/setup/import-enterprise/reset', {});
  },
};

// Exported for tests that want to assert the underlying instance's config.
export const __setupHttpClient = http;

export type { SetupStatus, HealthCheckResult, Step1Data, Step2Data };
