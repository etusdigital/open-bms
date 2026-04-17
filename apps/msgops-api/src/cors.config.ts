import type { CorsOptions } from 'cors';

const ALLOWED_ORIGINS = ['https://bms.bri.us', 'https://bms-new.bri.us', 'https://bms-stg.bri.us', 'https://admin.bri.us'];

const CF_PAGES_PATTERN = /^https:\/\/.*\.bms-frontend-react\.pages\.dev$/;
const LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

export function isOriginAllowed(origin: string | undefined, nodeEnv: string | undefined): boolean {
  // Allow requests with no origin (server-to-server, curl, health checks)
  if (!origin) return true;

  if (ALLOWED_ORIGINS.includes(origin)) return true;

  if (CF_PAGES_PATTERN.test(origin)) return true;

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
