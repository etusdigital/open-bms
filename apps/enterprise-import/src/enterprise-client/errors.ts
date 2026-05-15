// Erros tipados pra o processor distinguir falha-vs-pausa:
// - 4xx (exceto 429) → cancela com status='failed' (cliente errou: API key
//   inválida, sem permissão, payload errado). BullMQ não deve retry.
// - 5xx + timeout → retry com backoff exponencial até esgotar attempts.
// - 429 → backoff longo (60s) e retry separado.

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

// Retornado pelo client quando o endpoint NÃO existe (404). Statistics importer
// trata como skip silencioso ao invés de cancelar o job.
export class EnterpriseApi404Error extends EnterpriseApi4xxError {
  constructor(message: string) {
    super(404, message);
    this.name = 'EnterpriseApi404Error';
  }
}
