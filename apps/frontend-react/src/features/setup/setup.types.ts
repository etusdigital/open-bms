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
}

export interface Step2Data {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface Step3Data {
  baseUrl: string;
}

export type Step4Data =
  | { skip: true }
  | {
      skip?: false;
      apiKey: string;
      subuserEmail: string;
      subuserPrefix?: string;
      defaultIpPool?: string;
      webhookBaseUrl?: string;
    };

export type Step5Data =
  | { skip: true }
  | {
      skip?: false;
      accountName: string;
      poolName?: string;
      senderEmail?: string;
      senderName?: string;
      replyToEmail?: string;
      sendingLimit?: number;
      ips?: string[];
    };

export type Step6Data = { skip: true } | { skip?: false; skipReason?: string };

export type AdvanceStepInput =
  | { step: 1; data: Step1Data }
  | { step: 2; data: Step2Data }
  | { step: 3; data: Step3Data }
  | { step: 4; data: Step4Data }
  | { step: 5; data: Step5Data }
  | { step: 6; data: Step6Data };
