import { join } from 'path';

export function bmsConfigDir(): string {
  return process.env.BMS_CONFIG_DIR ?? '/data/config';
}

export function bmsConfigFilePath(filename: string): string {
  return join(bmsConfigDir(), filename);
}
