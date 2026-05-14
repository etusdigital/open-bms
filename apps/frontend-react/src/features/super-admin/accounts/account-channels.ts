import type { AccountConfig } from '@/types';
import type { AccountConfigUpdate } from '@/features/settings/types';
import { CHANNEL_CONFIG_NAMES, type ChannelKey } from './types';
import type { ChannelsValues } from './account-schema';

export const CHANNEL_KEYS = Object.keys(CHANNEL_CONFIG_NAMES) as ChannelKey[];

export function extractChannelDefaults(configs: AccountConfig[] | undefined): ChannelsValues {
  const result: ChannelsValues = { email: false, sms: false, webPush: false, mobilePush: false, whatsapp: false };
  if (!configs) return result;
  for (const key of CHANNEL_KEYS) {
    const c = configs.find((cc) => cc.name === CHANNEL_CONFIG_NAMES[key]);
    if (!c?.value) continue;
    try {
      result[key] = JSON.parse(c.value)?.isActive === true;
    } catch {
      // leave as false on parse error
    }
  }
  return result;
}

// Returns AccountConfigUpdate entries ONLY for channels whose toggle differs
// from the loaded defaults. This avoids:
//  - races overwriting unrelated fields (e.g. webpush subdomain) edited in
//    another tab between load and save (M5)
//  - triggering backend side-effects on every save (e.g. uploadWebPushFile,
//    sendPushRulesToCloudflareWorkers) for channels nobody toggled (H2)
export function buildChannelConfigUpdates(
  channels: ChannelsValues,
  existing: AccountConfig[] | undefined,
  accountId: number,
): AccountConfigUpdate[] {
  const defaults = extractChannelDefaults(existing);
  const updates: AccountConfigUpdate[] = [];

  for (const key of CHANNEL_KEYS) {
    if (channels[key] === defaults[key]) continue;
    const name = CHANNEL_CONFIG_NAMES[key];
    const existingConfig = existing?.find((cc) => cc.name === name);
    let parsed: Record<string, unknown> = {};
    if (existingConfig?.value) {
      try {
        const obj = JSON.parse(existingConfig.value);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          parsed = obj as Record<string, unknown>;
        }
      } catch {
        // start fresh on parse error
      }
    }
    parsed.isActive = channels[key];
    updates.push({ account_id: accountId, name, value: JSON.stringify(parsed) });
  }

  return updates;
}
