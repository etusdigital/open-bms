import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { UserEntity } from '../../entities/users.entity';
import { RoleEntity } from '../../entities/role.entity';
import { AccountEntity } from '../../entities/account.entity';
import { PoolEntity } from '../../entities/pool.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from '../auth/providers/auth.provider.interface';
import { ROLE_CODES } from '../authz/authz.constants';
import { AdvanceStepDto, Step1Data, Step2Data, Step3Data, Step4Data } from './dtos/advance-step.dto';
import { TestSmtpDto } from './dtos/test-smtp.dto';

const WIZARD_KEY = 'setup_wizard_step';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(SystemConfigEntity) private systemConfigRepo: Repository<SystemConfigEntity>,
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
    @InjectRepository(AccountEntity) private accountRepo: Repository<AccountEntity>,
    @InjectRepository(PoolEntity) private poolRepo: Repository<PoolEntity>,
    @InjectRepository(UserAccountEntity) private userAccountRepo: Repository<UserAccountEntity>,
    @Inject(AUTH_PROVIDER_TOKEN) private readonly authProvider: IAuthProvider,
  ) {}

  async getStatus(): Promise<{ configured: boolean; currentStep: number }> {
    const superAdminRole = await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
    if (superAdminRole) {
      const adminCount = await this.userRepo.count({ where: { globalRoleId: superAdminRole.id } });
      if (adminCount === 0) return { configured: false, currentStep: 1 };
    }

    const config = await this.systemConfigRepo.findOne({ where: { key: WIZARD_KEY } });
    if (!config) return { configured: false, currentStep: 1 };

    const { currentStep, completed } = config.value as { currentStep: number; completed: boolean };
    if (completed) return { configured: true, currentStep: 4 };
    return { configured: false, currentStep: currentStep || 1 };
  }

  async advanceStep(dto: AdvanceStepDto): Promise<void> {
    switch (dto.step) {
      case 1:
        return this.step1(dto.data as Step1Data);
      case 2:
        return this.step2(dto.data as Step2Data);
      case 3:
        return this.step3(dto.data as Step3Data);
      case 4:
        return this.step4(dto.data as Step4Data);
    }
  }

  private async step1(data: Step1Data): Promise<void> {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (!existing) {
      const superAdminRole = await this.roleRepo.findOneOrFail({ where: { code: ROLE_CODES.SUPER_ADMIN } });
      const { providerId } = await this.authProvider.createUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      const user = this.userRepo.create({
        name: data.name,
        email: data.email,
        providerId,
        profile: '',
        settings: { language: 'pt-BR' },
        globalRoleId: superAdminRole.id,
      });
      await this.userRepo.save(user);
      if (this.authProvider.supportsCredentialLogin()) {
        await this.authProvider.updatePassword(providerId, data.password);
      }
    }
    await this.upsertWizard(2);
  }

  private async step2(data: Step2Data): Promise<void> {
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: 'smtp_settings', value: data as any }));
    await this.upsertWizard(3);
  }

  private async step3(data: Step3Data): Promise<void> {
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: 'domain_settings', value: data as any }));
    await this.upsertWizard(4);
  }

  private async step4(data: Step4Data): Promise<void> {
    if (data.skip) {
      await this.completeWizard();
      return;
    }

    const account = this.accountRepo.create({
      name: data.accountName,
      groupId: 1,
      isActive: true,
      isInternal: false,
    });
    const savedAccount = await this.accountRepo.save(account);

    const pool = this.poolRepo.create({
      name: data.poolName,
      poolName: data.poolName,
      ip: data.ips ?? [],
      accountId: savedAccount.id,
      sendingLimit: data.sendingLimit ?? 1000,
      senderEmail: data.senderEmail,
      senderName: data.senderName,
      senderReplyTo: data.replyToEmail,
      isDefault: true,
    });
    await this.poolRepo.save(pool);

    const adminUser = await this.userRepo.findOne({
      where: { globalRoleId: (await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } }))?.id },
    });

    if (adminUser) {
      const userAccount = this.userAccountRepo.create({
        userId: adminUser.id,
        accountId: savedAccount.id,
        isMasterUser: true,
      });
      await this.userAccountRepo.save(userAccount);
    }

    await this.completeWizard();
  }

  async testSmtp(dto: TestSmtpDto): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: dto.host,
      port: dto.port,
      auth: { user: dto.user, pass: dto.pass },
    });
    try {
      await transporter.sendMail({
        from: dto.from,
        to: dto.toEmail,
        subject: 'Teste de configuração SMTP — BMS',
        text: 'Email de teste enviado com sucesso pelo assistente de configuração do BMS.',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Falha ao enviar email de teste.');
    }
  }

  private async upsertWizard(nextStep: number): Promise<void> {
    const existing = await this.systemConfigRepo.findOne({ where: { key: WIZARD_KEY } });
    const current = (existing?.value as any)?.currentStep ?? 0;
    if (nextStep <= current && existing) return;
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: WIZARD_KEY, value: { currentStep: nextStep, completed: false } }));
  }

  private async completeWizard(): Promise<void> {
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: WIZARD_KEY, value: { currentStep: 4, completed: true } }));
  }
}
