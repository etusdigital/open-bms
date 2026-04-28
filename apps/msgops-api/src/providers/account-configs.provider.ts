import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountConfigEntity } from '../entities/account-config.entity';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AccountConfigsProvider {
  constructor(
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,

    private readonly cls: ClsService,
  ) {}

  public async getAccountConfigs(name: string): Promise<any> {
    return await this.accountConfigRepository.findOne({
      where: {
        accountId: this.cls.get('accountId'),
        name,
      },
    });
  }

  // Explicit-accountId variant for code paths outside CLS context (workers,
  // multi-account producers, scheduled jobs).
  public async getByAccountId(accountId: number, name: string): Promise<AccountConfigEntity | null> {
    return await this.accountConfigRepository.findOne({
      where: { accountId, name },
    });
  }

  public async upsertByAccountId(accountId: number, name: string, value: string): Promise<void> {
    const existing = await this.accountConfigRepository.findOne({ where: { accountId, name } });
    if (existing) {
      existing.value = value;
      await this.accountConfigRepository.save(existing);
      return;
    }
    await this.accountConfigRepository.save(this.accountConfigRepository.create({ accountId, name, value }));
  }

  public async deleteByAccountId(accountId: number, name: string): Promise<void> {
    await this.accountConfigRepository.delete({ accountId, name });
  }
}
