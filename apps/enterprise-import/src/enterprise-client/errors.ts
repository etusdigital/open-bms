// Typed errors so the processor can decide fail-vs-retry:
// - 4xx (except 429): fail, no BullMQ retry (client error).
// - 5xx/timeout: retry with exponential backoff until attempts exhausted.
// - 429: long (60s) backoff, retried separately.

export class EnterpriseApi4xxError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`Enterprise API ${status}: ${message}`);
    this.status = status;
    this.name = 'EnterpriseApi4xxError';
  }
}

export class EnterpriseApi5xxError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`Enterprise API ${status}: ${message}`);
    this.status = status;
    this.name = 'EnterpriseApi5xxError';
  }
}

export class EnterpriseApiTimeoutError extends Error {
  constructor(message: string) {
    super(`Enterprise API timeout: ${message}`);
    this.name = 'EnterpriseApiTimeoutError';
  }
}

// 404 split out from other 4xx so the client can distinguish a missing
// endpoint/resource (optional endpoints use tolerate404) from real client errors.
export class EnterpriseApi404Error extends EnterpriseApi4xxError {
  constructor(message: string) {
    super(404, message);
    this.name = 'EnterpriseApi404Error';
  }
}
