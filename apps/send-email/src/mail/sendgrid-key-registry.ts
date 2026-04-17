import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class SendGridKeyRegistry implements OnModuleInit {
  private readonly logger = new Logger(SendGridKeyRegistry.name);
  private keys: Record<string, string> = {};

  onModuleInit() {
    const raw = process.env.SENDGRID_KEYS_MAP;
    if (!raw) {
      this.logger.warn('SENDGRID_KEYS_MAP not set — all key lookups will throw');
      return;
    }

    try {
      this.keys = JSON.parse(raw);
    } catch (e) {
      throw new Error(`SENDGRID_KEYS_MAP is not valid JSON: ${e.message}`);
    }

    this.logger.log(`Loaded ${Object.keys(this.keys).length} SendGrid keys`);
  }

  getKey(name: string): string {
    const key = this.keys[name];
    if (!key) {
      throw new Error(`SendGrid key "${name}" not found in SENDGRID_KEYS_MAP`);
    }
    return key;
  }
}
