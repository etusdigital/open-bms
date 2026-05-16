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

// 404 distinto dos demais 4xx: usado pelo client p/ diferenciar "endpoint/
// recurso inexistente" de outros erros do cliente (a versão do Enterprise de
// origem pode não expor uma rota — endpoints opcionais usam tolerate404).
export class EnterpriseApi404Error extends EnterpriseApi4xxError {
  constructor(message: string) {
    super(404, message);
    this.name = 'EnterpriseApi404Error';
  }
}
