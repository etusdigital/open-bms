export interface SetupStatus {
  configured: boolean;
  currentStep: number;
  baseUrl?: string;
}

export interface ServiceHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface HealthCheckResult {
  postgres: ServiceHealthResult;
  redis: ServiceHealthResult;
  clickhouse: ServiceHealthResult;
  rabbitmq: ServiceHealthResult;
  s3: ServiceHealthResult;
  smtp: ServiceHealthResult;
  allOk: boolean;
}

export interface Step1Data {
  name: string;
  email: string;
  password: string;
  accountName: string;
}

export type Step2Data =
  | { skip: true }
  | {
      skip?: false;
      host: string;
      port: number;
      user: string;
      pass: string;
      from: string;
    };

export interface Step3Data {
  baseUrl: string;
}

// SendGrid moved out of the setup wizard. The frontend auto-skips this step
// after step 3 (Domínio); the backend keeps the slot for compatibility.
export type Step4Data = { skip: true };

// Account is now created in step1 alongside the admin. The frontend auto-skips
// this step; backend keeps the slot for compatibility.
export type Step5Data = { skip: true };

export type Step6Data = { skip: true } | { skip?: false; skipReason?: string };

export type AdvanceStepInput =
  | { step: 1; data: Step1Data }
  | { step: 2; data: Step2Data }
  | { step: 3; data: Step3Data }
  | { step: 4; data: Step4Data }
  | { step: 5; data: Step5Data }
  | { step: 6; data: Step6Data };
