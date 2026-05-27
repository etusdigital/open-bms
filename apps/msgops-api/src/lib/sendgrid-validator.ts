import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';

const logger = new Logger('SendgridValidator');

export interface SendgridValidationResult {
  accountName: string | null;
}

export async function validateSendgridApiKey(apiKey: string, baseUrl?: string): Promise<SendgridValidationResult> {
  try {
    const base = (baseUrl ?? process.env.SENDGRID_API_BASE_URL ?? 'https://api.sendgrid.com').replace(/\/+$/, '');
    const res = await axios.get(`${base}/v3/user/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10_000,
      validateStatus: () => true,
    });

    if (res.status >= 200 && res.status < 300) {
      const name: string | undefined = res.data?.first_name || res.data?.company;
      return { accountName: name ?? null };
    }

    if (res.status === 401 || res.status === 403) {
      logger.warn(`SendGrid test rejected (HTTP ${res.status}): ${JSON.stringify(res.data)?.slice(0, 300)}`);
      throw new HttpException('Credenciais inválidas. Verifique se a API Key tem permissão Full Access.', HttpStatus.UNAUTHORIZED);
    }

    if (res.status === 429) {
      throw new HttpException('SendGrid aplicou rate limit. Aguarde alguns segundos e tente novamente.', HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.warn(`SendGrid test returned HTTP ${res.status}: ${JSON.stringify(res.data)?.slice(0, 200)}`);
    throw new HttpException('Falha ao validar credenciais SendGrid.', HttpStatus.BAD_GATEWAY);
  } catch (e: any) {
    if (e instanceof HttpException) throw e;
    logger.warn(`SendGrid test network error: ${e?.message ?? 'unknown'}`);
    throw new HttpException('Não foi possível contatar o SendGrid. Verifique sua conexão.', HttpStatus.BAD_GATEWAY);
  }
}
