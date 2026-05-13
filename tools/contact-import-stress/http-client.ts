/**
 * HTTP client for the stress test. Uses Node 20 native `fetch` + `AbortController`
 * to avoid pulling in extra deps. Two operations:
 *   - login()           → POST /auth/login → access token
 *   - importContacts()  → POST /contacts/import (the endpoint under test)
 */

import { performance } from 'node:perf_hooks';
import type { ContactBatch } from './payload-generator';

export class AuthError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Auth failed: HTTP ${status}`);
    this.name = 'AuthError';
    this.status = status;
    this.body = body;
  }
}

export interface LoginOptions {
  baseUrl: string;
  email: string;
  password: string;
}

/**
 * `POST /auth/login` against the LocalAuthProvider. Throws `AuthError` on non-200
 * so the runner can abort cleanly (AC6).
 */
export async function login(opts: LoginOptions): Promise<string> {
  const url = joinUrl(opts.baseUrl, '/auth/login');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: opts.email, password: opts.password }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AuthError(0, `Network error contacting ${url}: ${msg}`);
  }

  const text = await res.text();
  if (res.status !== 200 && res.status !== 201) {
    throw new AuthError(res.status, text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AuthError(res.status, `Non-JSON body from /auth/login: ${text.slice(0, 200)}`);
  }

  const token =
    (isObject(parsed) && typeof parsed.accessToken === 'string' && parsed.accessToken) ||
    (isObject(parsed) && typeof parsed.access_token === 'string' && parsed.access_token);

  if (!token) {
    throw new AuthError(res.status, `Login response missing accessToken: ${text.slice(0, 200)}`);
  }
  return token;
}

export interface ImportOptions {
  baseUrl: string;
  token: string;
  accountId: string;
  batch: ContactBatch;
  timeoutMs: number;
}

export interface ImportResult {
  status: number | null; // null when request was aborted before a status was received
  durationMs: number;
  aborted: boolean;
  responseBody: string; // truncated; useful for failure diagnostics
}

/**
 * Fires a single `POST /contacts/import` and reports timing + outcome. Never throws
 * for HTTP-level failures — only the runner decides what to do with them. Network
 * errors that aren't an abort still bubble up so misconfigured hosts surface fast.
 */
export async function importContacts(opts: ImportOptions): Promise<ImportResult> {
  const url = joinUrl(opts.baseUrl, '/contacts/import');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.token}`,
        'Account-Id': opts.accountId,
      },
      body: JSON.stringify(opts.batch),
      signal: controller.signal,
    });
    const body = await safeReadText(res);
    return {
      status: res.status,
      durationMs: performance.now() - started,
      aborted: false,
      responseBody: body.slice(0, 500),
    };
  } catch (err) {
    const durationMs = performance.now() - started;
    if (controller.signal.aborted) {
      return { status: null, durationMs, aborted: true, responseBody: '' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { status: null, durationMs, aborted: false, responseBody: `network-error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${trimmed}${tail}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
