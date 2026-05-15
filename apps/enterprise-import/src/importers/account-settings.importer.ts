import { Injectable } from '@nestjs/common';
import { ImportContext, ImporterStep } from './importer.interface';
import { AccountConfigEntity } from '../../../msgops-api/src/entities/account-config.entity';

const PROVIDERS = ['sparkpost', 'sendgrid', 'mailersend', 'resend', 'ses', 'mandrill'] as const;

// Varredura provider-a-provider via getAccountSettings (404 tolerado). Grava em
// accounts_configs com nome `<provider>_settings`. F1: a coluna `value` é TEXT
// (não jsonb) e `is_load_config` é NOT NULL — usamos o Repository da entity
// real e serializamos o objeto como string.
@Injectable()
export class AccountSettingsImporter implements ImporterStep {
  readonly name = 'account-settings';

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId === null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }

    const repo = ctx.dataSource.getRepository<AccountConfigEntity>(AccountConfigEntity);
    let done = 0;
    for (const provider of PROVIDERS) {
      const settings = await ctx.client.getAccountSettings(ctx.enterpriseSourceAccountId ?? ctx.accountId, provider);
      done++;
      if (!settings) continue;
      await repo
        .createQueryBuilder()
        .insert()
        .values({
          accountId: ctx.accountId,
          name: `${provider}_settings`,
          value: JSON.stringify(settings),
          isLoadConfig: true,
        } as any)
        .updateEntity(false)
        .orUpdate(['value'], ['account_id', 'name'])
        .execute();
    }
    await ctx.setCheckpoint(this.name, 1, ctx.accountId);
    await ctx.updateProgress(this.name, { total: PROVIDERS.length, done, page: 1 });
  }
}
