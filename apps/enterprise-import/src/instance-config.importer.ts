import { Injectable, Logger } from '@nestjs/common';
import { ImportContext, ImporterStep } from './importers/importer.interface';
import { SystemConfigEntity } from '../../msgops-api/src/entities/system-config.entity';

// Whitelist de chaves system_config replicáveis Enterprise → OSS.
//
// F12: SEMPRE excluímos chaves de bootstrap/setup do OSS (bootstrap_admin_*,
// setup_complete, setup_wizard_step) e usamos ON CONFLICT DO NOTHING — assim a
// importação NUNCA sobrescreve o que o Setup Wizard acabou de gravar (domínio,
// provider de e-mail etc.); só preenche chaves AUSENTES no OSS virgem.
// Sufixo `*` = glob de prefixo simples (ex.: `smtp_*`).
const INSTANCE_CONFIG_WHITELIST = ['default_email_provider', 'default_domain', 'smtp_*', 'feature_flags', 'account_costs_global'];

const INSTANCE_CONFIG_DENYLIST = ['bootstrap_admin_', 'setup_complete', 'setup_wizard_step'];

@Injectable()
export class InstanceConfigImporter implements ImporterStep {
  readonly name = 'instance-config';
  private readonly logger = new Logger(InstanceConfigImporter.name);

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.scope !== 'instance') {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'scope_account' });
      return;
    }

    const config = await ctx.client.getInstanceConfig();
    const allowedEntries = Object.entries(config ?? {}).filter(([key]) => this.isAllowed(key));

    const repo = ctx.dataSource.getRepository<SystemConfigEntity>(SystemConfigEntity);
    let done = 0;
    await ctx.dataSource.transaction(async (em) => {
      const txRepo = em.getRepository<SystemConfigEntity>(SystemConfigEntity);
      for (const [key, value] of allowedEntries) {
        await txRepo
          .createQueryBuilder()
          .insert()
          .values({ key, value: value as any } as any)
          .updateEntity(false)
          .orIgnore() // DO NOTHING — preserva config do setup do OSS (F12)
          .execute();
        done++;
      }
    });
    void repo;

    this.logger.log(`[instance-config] filled ${done}/${Object.keys(config ?? {}).length} absent keys (whitelist+denylist applied)`);
    await ctx.setCheckpoint(this.name, 1);
    await ctx.updateProgress(this.name, { total: allowedEntries.length, done, page: 1 });
  }

  private isAllowed(key: string): boolean {
    if (INSTANCE_CONFIG_DENYLIST.some((d) => key === d || key.startsWith(d))) return false;
    for (const pattern of INSTANCE_CONFIG_WHITELIST) {
      if (pattern.endsWith('*')) {
        if (key.startsWith(pattern.slice(0, -1))) return true;
      } else if (key === pattern) {
        return true;
      }
    }
    return false;
  }
}
