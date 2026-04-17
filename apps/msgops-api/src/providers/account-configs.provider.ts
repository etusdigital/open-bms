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
}
