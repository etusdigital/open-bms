import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { UserEntity } from '../entities/users.entity';
import { UserAccountEntity } from '../entities/users-account.entity';
import { rawInsertPreservingPk, dbNameMap } from '../raw-insert.util';

// F2: a entity `users` NÃO tem colunas password_hash/password_reset_required —
// credenciais locais ficam em `user_credentials` (auth plugável). Hashes bcrypt
// do Enterprise não são exportáveis pela API pública, então usuários importados
// ficam SEM credencial: precisam usar "esqueci a senha"/reset administrativo no
// primeiro acesso (LocalAuthProvider) ou logar via Auth0 se configurado.
//
// Users é global (sem account_id). Chave natural = email. Liga ao account-scope
// atual via users_accounts. ID remapeado em scope=account; preservado em
// scope=instance.
@Injectable()
export class UsersImporter implements ImporterStep {
  readonly name = 'users';
  private readonly logger = new Logger(UsersImporter.name);

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId === null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }

    const batchSize = 500;
    const userRepo = ctx.dataSource.getRepository<UserEntity>(UserEntity);
    const meta = userRepo.metadata;
    const columnProps = new Set(meta.columns.map((c) => c.propertyName));
    const pkProp = meta.primaryColumns[0]?.propertyName ?? 'id';

    let page = ctx.checkpoint?.entity === this.name && ctx.checkpoint?.page ? ctx.checkpoint.page : 1;
    let done = 0;
    let totalKnown: number | undefined;

    while (true) {
      const resp = await ctx.client.listUsers(ctx.accountId, { page, itemsPerPage: batchSize });
      if (!resp.results || resp.results.length === 0) break;
      if (resp.totalItems !== undefined) totalKnown = resp.totalItems;

      const byEmail = new Map<string, any>();
      for (const u of resp.results) {
        if (u?.email && !byEmail.has(u.email)) byEmail.set(u.email, u);
      }
      const emails = [...byEmail.keys()];
      if (emails.length === 0) {
        if (resp.results.length < batchSize) break;
        page++;
        continue;
      }

      await ctx.dataSource.transaction(async (em) => {
        const txUserRepo = em.getRepository<UserEntity>(UserEntity);
        const txUaRepo = em.getRepository<UserAccountEntity>(UserAccountEntity);

        const existing = await txUserRepo.find({ where: { email: In(emails) } as any });
        const userByEmail = new Map<string, any>();
        for (const e of existing as any[]) userByEmail.set(e.email, e);

        const toInsert: Record<string, any>[] = [];
        for (const [email, u] of byEmail) {
          if (userByEmail.has(email)) continue;
          const row: Record<string, any> = {};
          for (const key of Object.keys(u)) if (columnProps.has(key)) row[key] = u[key];
          if (ctx.scope === 'account') delete row[pkProp];
          else if (u[pkProp] !== undefined) row[pkProp] = u[pkProp];
          toInsert.push(row);
        }
        if (toInsert.length > 0) {
          if (ctx.scope === 'instance') {
            await rawInsertPreservingPk(em, 'users', dbNameMap(txUserRepo.metadata), toInsert);
          } else {
            await txUserRepo
              .createQueryBuilder()
              .insert()
              .values(toInsert as any)
              .updateEntity(false)
              .orIgnore()
              .execute();
          }
        }

        // Relê todos (existentes + novos) por email p/ resolver ids.
        const all = await txUserRepo.find({ where: { email: In(emails) } as any });
        const idByEmail = new Map<string, any>();
        for (const e of all as any[]) idByEmail.set(e.email, e[pkProp]);

        for (const [email, u] of byEmail) {
          const newUserId = idByEmail.get(email);
          if (newUserId === undefined) continue;
          if (ctx.scope === 'account' && u[pkProp] !== undefined && u[pkProp] !== null) {
            await ctx.idMapper.record(ctx.jobId, this.name, u[pkProp], newUserId);
          }
          // Link users_accounts (PK composto user_id+account_id+is_master_user).
          await txUaRepo
            .createQueryBuilder()
            .insert()
            .values({ userId: newUserId, accountId: ctx.accountId, isMasterUser: !!u.isMasterUser } as any)
            .updateEntity(false)
            .orIgnore()
            .execute();
        }
      });

      done += byEmail.size;
      await ctx.setCheckpoint(this.name, page, ctx.accountId);
      await ctx.updateProgress(this.name, { total: totalKnown, done, page });
      if (resp.results.length < batchSize) break;
      page++;
    }
    this.logger.log(`[users] imported ${done} users for account=${ctx.accountId} (credentials require reset)`);
  }
}
