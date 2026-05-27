import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

// The Enterprise baseUrl is user-supplied and the worker makes requests to it
// -> SSRF vector. Block loopback/private/link-local/metadata and optionally
// restrict to an allowlist (ENTERPRISE_IMPORT_ALLOWED_HOSTS, CSV of hosts).
// In production, require https.

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local (includes 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true; // link-local / ULA
  if (lower.startsWith('::ffff:')) return isPrivateIpv4(lower.slice(7)); // IPv4-mapped
  return false;
}

export function assertSafeEnterpriseBaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('enterpriseBaseUrl inválida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('enterpriseBaseUrl deve ser http(s)');
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && url.protocol !== 'https:') {
    throw new BadRequestException('enterpriseBaseUrl deve usar https em produção');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  const allowlist = (process.env.ENTERPRISE_IMPORT_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0) {
    if (!allowlist.includes(host)) {
      throw new BadRequestException('enterpriseBaseUrl não está na allowlist (ENTERPRISE_IMPORT_ALLOWED_HOSTS)');
    }
    return url.toString();
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new BadRequestException('enterpriseBaseUrl aponta para host local — bloqueado (SSRF)');
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new BadRequestException('enterpriseBaseUrl aponta para IP privado/loopback — bloqueado (SSRF)');
  }
  if (ipVersion === 6 && isPrivateIpv6(host)) {
    throw new BadRequestException('enterpriseBaseUrl aponta para IP privado/loopback — bloqueado (SSRF)');
  }
  // Hostnames that resolve only to a private IP can still pass here; the
  // allowlist is the strong defense recommended in sensitive environments.
  return url.toString();
}
