import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AutomationMessageAccountEntity } from './../../entities/automation-message-account.entity';
import { Repository } from 'typeorm';
import { AutomationMessageAccountDto } from './automation-message-account.dto';

@Injectable()
export class AutomationMessageAccountService {
  constructor(
    @InjectRepository(AutomationMessageAccountEntity)
    private readonly automationMessageAccountRepository: Repository<AutomationMessageAccountEntity>,
  ) {}

  async createAutomationMessageAccount(automationMessageAccountDto: AutomationMessageAccountDto): Promise<AutomationMessageAccountDto> {
    try {
      const automationMessageAccount = await this.automationMessageAccountRepository.create(automationMessageAccountDto);
      const automationMessageAccountOld = await this.findOneByMessageIdAndAccountId({
        providerAccountId: automationMessageAccountDto.providerAccountId,
        message: {
          id: automationMessageAccountDto.message.id,
        },
        provider: automationMessageAccountDto.provider,
      });

      if (automationMessageAccountOld) {
        automationMessageAccount.id = automationMessageAccountOld.id;
      }

      return await this.automationMessageAccountRepository.save(automationMessageAccount);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneByMessageIdAndAccountId(automationMessageAccountDto: AutomationMessageAccountDto): Promise<AutomationMessageAccountEntity> {
    try {
      return await this.automationMessageAccountRepository.findOne({ where: automationMessageAccountDto as any });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
