import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationMessageAccountEntity } from './../../entities/automation-message-account.entity';
import { AutomationMessageAccountDto } from './automation-message-account.dto';
import { AutomationMessageAccountService } from './automations-message-account.service';

class RepositoryMockAutomationMessageAccount {
  private MessagesAccount = [
    {
      id: 1,
      testId: '1233',
      providerAccountId: '34565',
      message: {
        id: 1,
        title: 'test',
        subject: 'test',
        content: 'test',
        fromMail: 'test@test.com',
        fromName: 'test',
        isTested: true,
      },
    },
  ];

  async findOne(automationMessageAccountDto: AutomationMessageAccountDto) {
    expect(automationMessageAccountDto).toBeDefined();
    return this.MessagesAccount[0];
  }

  create(automationMessageAccountDto: AutomationMessageAccountDto) {
    expect(automationMessageAccountDto).toHaveProperty('testId');
    expect(automationMessageAccountDto.testId).toBeDefined();
    expect(automationMessageAccountDto).toHaveProperty('providerAccountId');
    expect(automationMessageAccountDto.providerAccountId).toBeDefined();
    expect(automationMessageAccountDto).toHaveProperty('message');
    expect(automationMessageAccountDto.message).toBeDefined();
    expect(automationMessageAccountDto.message).toHaveProperty('id');
    expect(automationMessageAccountDto.message.id).toBeDefined();

    return automationMessageAccountDto;
  }

  async save(automationMessageAccountDto: AutomationMessageAccountDto) {
    expect(automationMessageAccountDto).toHaveProperty('testId');
    expect(automationMessageAccountDto.testId).toBeDefined();
    expect(automationMessageAccountDto).toHaveProperty('providerAccountId');
    expect(automationMessageAccountDto.providerAccountId).toBeDefined();
    expect(automationMessageAccountDto).toHaveProperty('message');
    expect(automationMessageAccountDto.message).toBeDefined();
    expect(automationMessageAccountDto.message).toHaveProperty('id');
    expect(automationMessageAccountDto.message.id).toBeDefined();

    automationMessageAccountDto.id = 1;

    return automationMessageAccountDto;
  }
}

describe('AutomationMessageAccountService', () => {
  let automationMessageAccountService: AutomationMessageAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationMessageAccountService,
        {
          provide: getRepositoryToken(AutomationMessageAccountEntity),
          useClass: RepositoryMockAutomationMessageAccount,
        },
      ],
    }).compile();

    automationMessageAccountService = module.get<AutomationMessageAccountService>(AutomationMessageAccountService);
  });

  it('should be defined', () => {
    expect(automationMessageAccountService).toBeDefined();
  });

  it('should list automations message account by messageId and providerAccountId', async () => {
    const result = {
      id: 1,
      testId: '1233',
      providerAccountId: '34565',
      message: {
        id: 1,
        title: 'test',
        subject: 'test',
        content: 'test',
        fromMail: 'test@test.com',
        fromName: 'test',
        isTested: true,
      },
    };

    expect(await automationMessageAccountService.findOneByMessageIdAndAccountId(result)).toStrictEqual(result);
  });

  it('should create an automation message account', async () => {
    const result = {
      id: 1,
      testId: '1233',
      providerAccountId: '34565',
      message: {
        id: 1,
        title: 'test',
        subject: 'test',
        content: 'test',
        fromMail: 'test@test.com',
        fromName: 'test',
        isTested: true,
      },
    };

    expect(await automationMessageAccountService.createAutomationMessageAccount(result)).toBe(result);
  });
});
