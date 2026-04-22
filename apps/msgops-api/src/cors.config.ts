import type { CorsOptions } from 'cors';

const LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCloudflarePagesPattern(projectName: string | undefined): RegExp | null {
  if (!projectName) return null;
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https:\\/\\/.*\\.${escaped}\\.pages\\.dev$`);
}

export function isOriginAllowed(origin: string | undefined, nodeEnv: string | undefined): boolean {
  // Allow requests with no origin (server-to-server, curl, health checks)
  if (!origin) return true;

  const allowedOrigins = parseList(process.env.CORS_ORIGINS);
  if (allowedOrigins.includes(origin)) return true;

  const cfPagesPattern = buildCloudflarePagesPattern(process.env.CORS_CF_PAGES_PROJECT);
  if (cfPagesPattern && cfPagesPattern.test(origin)) return true;

  // Allow localhost in development
  if (nodeEnv !== 'production' && LOCALHOST_PATTERN.test(origin)) return true;

  return false;
}

export function createCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, process.env.NODE_ENV)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
  };
}
