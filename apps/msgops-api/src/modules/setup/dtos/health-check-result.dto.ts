export class ServiceHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export class HealthCheckResult {
  postgres: ServiceHealthResult;
  redis: ServiceHealthResult;
  clickhouse: ServiceHealthResult;
  rabbitmq: ServiceHealthResult;
  s3: ServiceHealthResult;
  smtp: ServiceHealthResult;
  allOk: boolean;
}
