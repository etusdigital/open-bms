import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { UserEntity } from '../../entities/users.entity';
import { RoleEntity } from '../../entities/role.entity';
import { AccountEntity } from '../../entities/account.entity';
import { PoolEntity } from '../../entities/pool.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from '../auth/providers/auth.provider.interface';
import { ROLE_CODES } from '../authz/authz.constants';
import { AdvanceStepDto, STEP_SCHEMAS, Step1Data, Step2Data, Step3Data, Step4Data, Step5Data } from './dtos/advance-step.dto';
import { TestSmtpDto } from './dtos/test-smtp.dto';
import { TestSendgridDto } from './dtos/test-sendgrid.dto';

const WIZARD_KEY = 'setup_wizard_step';
const SMTP_KEY = 'smtp_settings';
const DOMAIN_KEY = 'domain_settings';
const SENDGRID_KEY = 'sendgrid_settings';
// Shared with seedAdmin (bootstrap/seed-admin.ts) so the wizard serializes against the same lock.
const ADVISORY_LOCK_KEY = 834729;
// Rate limit for testSmtp — window in ms and max attempts per IP in that window.
const TEST_SMTP_WINDOW_MS = 60_000;
const TEST_SMTP_MAX_PER_WINDOW = 5;

type WizardState = {
  currentStep: number;
  completed: boolean;
  adminUserId?: number;
};

type SmtpSettings = Omit<Step2Data, never>;
type DomainSettings = Step3Data;
type SendgridSettings = {
  apiKey: string;
  subuserEmail: string;
  subuserPrefix?: string;
  defaultIpPool?: string;
  webhookBaseUrl?: string;
};

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private readonly testSmtpHits = new Map<string, number[]>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SystemConfigEntity) private systemConfigRepo: Repository<SystemConfigEntity>,
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
    @InjectRepository(AccountEntity) private accountRepo: Repository<AccountEntity>,
    @InjectRepository(PoolEntity) private poolRepo: Repository<PoolEntity>,
    @InjectRepository(UserAccountEntity) private userAccountRepo: Repository<UserAccountEntity>,
    @Inject(AUTH_PROVIDER_TOKEN) private readonly authProvider: IAuthProvider,
  ) {}

  async getStatus(): Promise<{ configured: boolean; currentStep: number; baseUrl?: string }> {
    const state = await this.readWizard();
    if (state?.completed) return { configured: true, currentStep: 5 };

    const superAdminRole = await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
    if (superAdminRole) {
      const adminCount = await this.userRepo.count({ where: { globalRoleId: superAdminRole.id } });
      if (adminCount === 0) return { configured: false, currentStep: 1 };
    }

    if (!state) return { configured: false, currentStep: 1 };

    // Expose the step-3 baseUrl so Step4Sendgrid can pre-fill the webhook URL
    // without a second round-trip.
    const domainCfg = await this.systemConfigRepo.findOne({ where: { key: DOMAIN_KEY } });
    const baseUrl: string | undefined = (domainCfg?.value as any)?.baseUrl;

    return { configured: false, currentStep: state.currentStep || 1, ...(baseUrl && { baseUrl }) };
  }

  async advanceStep(dto: AdvanceStepDto): Promise<void> {
    await this.ensureNotConfigured();

    const schema = STEP_SCHEMAS[dto.step];
    const { value, error } = schema.validate(dto.data, { abortEarly: false, stripUnknown: true });
    if (error) {
      throw new BadRequestException(error.details.map((d) => d.message).join('; '));
    }

    // Enforce step ordering server-side: a client cannot jump to step N without having
    // reached N-1. Idempotent re-submits of the current or a prior step are allowed so the
    // user can re-run a step whose side-effects already landed.
    const state = await this.readWizard();
    const expectedStep = state?.currentStep ?? 1;
    if (dto.step > expectedStep) {
      throw new BadRequestException(`Out-of-order step: expected ${expectedStep}, got ${dto.step}`);
    }

    switch (dto.step) {
      case 1:
        return this.step1(value as Step1Data);
      case 2:
        return this.step2(value as Step2Data);
      case 3:
        return this.step3(value as Step3Data);
      case 4:
        return this.step4(value as Step4Data);
      case 5:
        return this.step5(value as Step5Data);
    }
  }

  private async step1(data: Step1Data): Promise<void> {
    const email = data.email.trim().toLowerCase();

    // Serialize with seedAdmin and concurrent wizard submissions — prevents two parallel
    // POSTs from both creating a super-admin before either has committed.
    await this.dataSource.transaction(async (em) => {
      await em.query(`SELECT pg_advisory_xact_lock($1)`, [ADVISORY_LOCK_KEY]);

      const userRepo = em.getRepository(UserEntity);
      const roleRepo = em.getRepository(RoleEntity);
      const systemConfigRepo = em.getRepository(SystemConfigEntity);

      const existing = await userRepo.findOne({ where: { email } });
      let adminUserId: number;

      if (existing) {
        adminUserId = existing.id;
      } else {
        const superAdminRole = await roleRepo.findOneOrFail({ where: { code: ROLE_CODES.SUPER_ADMIN } });
        const { providerId } = await this.authProvider.createUser({
          name: data.name,
          email,
          password: data.password,
        });
        const user = userRepo.create({
          name: data.name,
          email,
          providerId,
          profile: '',
          settings: { language: 'pt-BR' },
          globalRoleId: superAdminRole.id,
        });
        const saved = await userRepo.save(user);
        adminUserId = saved.id;

        if (this.authProvider.supportsCredentialLogin()) {
          try {
            await this.authProvider.updatePassword(providerId, data.password, em);
          } catch (err) {
            // Password persistence failed after user was created — roll back the local user
            // row so the wizard can be retried cleanly. Provider-side user may remain orphaned
            // depending on the provider impl; that's out of scope for this transaction.
            await userRepo.remove(saved);
            throw err;
          }
        }
      }

      await this.upsertWizardTx(systemConfigRepo, { currentStep: 2, adminUserId });
    });
  }

  private async step2(data: Step2Data): Promise<void> {
    const value: SmtpSettings = { ...data };
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: SMTP_KEY, value }));
    await this.upsertWizard({ currentStep: 3 });
  }

  private async step3(data: Step3Data): Promise<void> {
    const value: DomainSettings = { ...data };
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: DOMAIN_KEY, value }));
    await this.upsertWizard({ currentStep: 4 });
  }

  private async step4(data: Step4Data): Promise<void> {
    if (data.skip) {
      await this.upsertWizard({ currentStep: 5 });
      return;
    }

    const value: SendgridSettings = {
      apiKey: data.apiKey!,
      subuserEmail: data.subuserEmail!,
      ...(data.subuserPrefix && { subuserPrefix: data.subuserPrefix }),
      ...(data.defaultIpPool && { defaultIpPool: data.defaultIpPool }),
      ...(data.webhookBaseUrl && { webhookBaseUrl: data.webhookBaseUrl }),
    };
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: SENDGRID_KEY, value }));
    await this.upsertWizard({ currentStep: 5 });
  }

  private async step5(data: Step5Data): Promise<void> {
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

    // Prefer the admin created by step1 (stored in wizard state). Fall back to "first
    // super-admin" only when the wizard state has no record — preserves the original
    // behavior for wizards started before this field existed.
    const state = await this.readWizard();
    let adminUser: UserEntity | null = null;
    if (state?.adminUserId) {
      adminUser = await this.userRepo.findOne({ where: { id: state.adminUserId } });
    }
    if (!adminUser) {
      const superAdminRole = await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
      if (superAdminRole) {
        adminUser = await this.userRepo.findOne({
          where: { globalRoleId: superAdminRole.id },
          order: { id: 'ASC' },
        });
      }
    }

    if (adminUser) {
      const userAccount = this.userAccountRepo.create({
        userId: adminUser.id,
        accountId: savedAccount.id,
        isMasterUser: true,
      });
      await this.userAccountRepo.save(userAccount);
    } else {
      this.logger.warn(`Setup step5: created account ${savedAccount.id} but no admin user found to link as master`);
    }

    await this.completeWizard();
  }

  async testSendgrid(dto: TestSendgridDto, requesterIp?: string): Promise<{ accountName: string | null }> {
    await this.ensureNotConfigured();
    this.enforceTestSendgridRateLimit(requesterIp);

    try {
      const res = await axios.get('https://api.sendgrid.com/v3/user/account', {
        headers: { Authorization: `Bearer ${dto.apiKey}` },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        const name: string | undefined = res.data?.first_name || res.data?.company || res.data?.type;
        return { accountName: name ?? null };
      }
      if (res.status === 401 || res.status === 403) {
        throw new HttpException('Credenciais inválidas. Verifique se a API Key tem permissão Full Access.', HttpStatus.UNAUTHORIZED);
      }
      if (res.status === 429) {
        throw new HttpException('SendGrid aplicou rate limit. Aguarde alguns segundos e tente novamente.', HttpStatus.TOO_MANY_REQUESTS);
      }
      this.logger.warn(`SendGrid test returned HTTP ${res.status}: ${JSON.stringify(res.data)?.slice(0, 200)}`);
      throw new HttpException('Falha ao validar credenciais SendGrid.', HttpStatus.BAD_GATEWAY);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      this.logger.warn(`SendGrid test network error: ${e?.message ?? 'unknown'}`);
      throw new HttpException('Não foi possível contatar o SendGrid. Verifique sua conexão.', HttpStatus.BAD_GATEWAY);
    }
  }

  async testSmtp(dto: TestSmtpDto, requesterIp?: string): Promise<void> {
    await this.ensureNotConfigured();
    this.enforceTestSmtpRateLimit(requesterIp);

    // AC#2 says the test email lands on the admin's address. Resolve it server-side from
    // the step1 admin so the endpoint cannot be used as an open relay with arbitrary
    // recipients.
    const toEmail = await this.resolveAdminEmail();
    if (!toEmail) {
      throw new BadRequestException('Complete step 1 (create admin) before testing SMTP.');
    }

    const transporter = nodemailer.createTransport({
      host: dto.host,
      port: dto.port,
      auth: { user: dto.user, pass: dto.pass },
    });
    try {
      await transporter.sendMail({
        from: dto.from,
        to: toEmail,
        subject: 'Teste de configuração SMTP — BMS',
        text: 'Email de teste enviado com sucesso pelo assistente de configuração do BMS.',
      });
    } catch (e: any) {
      // Log the underlying cause server-side (topology may be sensitive) but return a
      // generic message to the client.
      this.logger.warn(`SMTP test failed for host=${dto.host}: ${e?.message ?? 'unknown error'}`);
      throw new HttpException('Falha ao enviar email de teste. Verifique as credenciais e tente novamente.', HttpStatus.BAD_GATEWAY);
    }
  }

  private async ensureNotConfigured(): Promise<void> {
    const state = await this.readWizard();
    if (state?.completed) {
      throw new ForbiddenException('Setup is already complete.');
    }
  }

  private enforceTestSmtpRateLimit(requesterIp?: string): void {
    const key = requesterIp || 'unknown';
    const now = Date.now();
    const windowStart = now - TEST_SMTP_WINDOW_MS;
    const hits = (this.testSmtpHits.get(key) || []).filter((t) => t > windowStart);
    if (hits.length >= TEST_SMTP_MAX_PER_WINDOW) {
      throw new HttpException('Too many SMTP test attempts. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.testSmtpHits.set(key, hits);
  }

  private enforceTestSendgridRateLimit(requesterIp?: string): void {
    const key = `sg:${requesterIp || 'unknown'}`;
    const now = Date.now();
    const windowStart = now - TEST_SMTP_WINDOW_MS;
    const hits = (this.testSmtpHits.get(key) || []).filter((t) => t > windowStart);
    if (hits.length >= TEST_SMTP_MAX_PER_WINDOW) {
      throw new HttpException('Too many SendGrid test attempts. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.testSmtpHits.set(key, hits);
  }

  private async resolveAdminEmail(): Promise<string | null> {
    const state = await this.readWizard();
    if (state?.adminUserId) {
      const user = await this.userRepo.findOne({ where: { id: state.adminUserId } });
      if (user?.email) return user.email;
    }
    const superAdminRole = await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
    if (!superAdminRole) return null;
    const user = await this.userRepo.findOne({
      where: { globalRoleId: superAdminRole.id },
      order: { id: 'ASC' },
    });
    return user?.email ?? null;
  }

  private async readWizard(): Promise<WizardState | null> {
    const config = await this.systemConfigRepo.findOne({ where: { key: WIZARD_KEY } });
    if (!config) return null;
    return config.value as WizardState;
  }

  private async upsertWizard(patch: Partial<WizardState> & { currentStep: number }): Promise<void> {
    const existing = await this.readWizard();
    const nextStep = patch.currentStep;
    const currentStep = existing?.currentStep ?? 0;
    if (existing && nextStep <= currentStep) {
      // Still merge forward-compatible fields (e.g., adminUserId) even when step doesn't advance.
      if (patch.adminUserId && patch.adminUserId !== existing.adminUserId) {
        await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: WIZARD_KEY, value: { ...existing, adminUserId: patch.adminUserId } }));
      }
      return;
    }
    const next: WizardState = {
      currentStep: nextStep,
      completed: false,
      adminUserId: patch.adminUserId ?? existing?.adminUserId,
    };
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: WIZARD_KEY, value: next }));
  }

  // Same semantics as upsertWizard but bound to a transaction's repository.
  private async upsertWizardTx(repo: Repository<SystemConfigEntity>, patch: Partial<WizardState> & { currentStep: number }): Promise<void> {
    const existing = await repo.findOne({ where: { key: WIZARD_KEY } });
    const existingValue = (existing?.value as WizardState | undefined) ?? null;
    const currentStep = existingValue?.currentStep ?? 0;
    if (existingValue && patch.currentStep <= currentStep) {
      if (patch.adminUserId && patch.adminUserId !== existingValue.adminUserId) {
        await repo.save(repo.create({ key: WIZARD_KEY, value: { ...existingValue, adminUserId: patch.adminUserId } }));
      }
      return;
    }
    const next: WizardState = {
      currentStep: patch.currentStep,
      completed: false,
      adminUserId: patch.adminUserId ?? existingValue?.adminUserId,
    };
    await repo.save(repo.create({ key: WIZARD_KEY, value: next }));
  }

  private async completeWizard(): Promise<void> {
    const existing = await this.readWizard();
    const next: WizardState = {
      currentStep: 4,
      completed: true,
      adminUserId: existing?.adminUserId,
    };
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: WIZARD_KEY, value: next }));
  }
}
