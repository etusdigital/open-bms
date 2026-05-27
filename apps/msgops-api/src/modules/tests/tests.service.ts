import { Injectable } from '@nestjs/common';
import { GlockAppsHandler } from '../../handlers/tests/email/glockapps/glockapps.handler';
import { TestAccountDto } from './test-account.dto';
import { TestCreateDto } from './test-create.dto';
import { TestCreatedDto } from './test-created.dto';
import { TestMessageDto } from './test-message.dto';
import { ProviderEnum } from '../../handlers/tests/email/interfaces/interface';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';
import { SparkPostHandler } from '../../handlers/email/sparkpost/sparkPost.handler';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class TestsService {
  constructor(
    private readonly handlerInstance: GlockAppsHandler,
    private readonly sendGridHandler: SendgridHandler,
    private readonly sparkPostHandler: SparkPostHandler,
    private readonly accountsService: AccountsService,
  ) {}

  private getPercentage(...values: Array<number>): number {
    return ((values[0] ? values[0] : 0) / values.reduce((result, value) => (value ? value : 0) + result)) * 100;
  }

  private calculatePercentageOverAll(value: any, name: string) {
    return {
      name: name,
      inbox: this.getPercentage(value.inbox, value.missing, value.spam, value.other) || 0,
      missing: this.getPercentage(value.missing, value.inbox, value.spam, value.other) || 0,
      spam: this.getPercentage(value.spam, value.inbox, value.missing, value.other) || 0,
      other: this.getPercentage(value.other, value.inbox, value.missing, value.spam) || 0,
    };
  }

  async getGmailTestStats(testIdsForAccount: Array<TestCreatedDto>) {
    try {
      const response = await this.handlerInstance.listResults(testIdsForAccount);
      return Object.entries(response.providers).map((provider: any) => {
        return {
          ...this.calculatePercentageOverAll(provider[1], 'Gmail'),
          finished: provider[1]['finished'],
        };
      })[0];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async listResults(testIdsForAccount: Array<TestCreatedDto>) {
    let glockApps = {};
    const sendGlockApps = testIdsForAccount.filter((accounts) => accounts.provider == 'glockApps');
    if (sendGlockApps.length) {
      const response = await this.handlerInstance.listResults(testIdsForAccount);
      glockApps = await this.processReturnGlock(response);
    }
    return {
      glockApps,
    };
  }

  async processReturnGlock(response) {
    return {
      ...this.calculatePercentageOverAll(response, response.name),
      finished: response.finished,
      providers: Object.entries(response.providers).map((provider) => {
        return {
          ...this.calculatePercentageOverAll(provider[1], provider[0]),
          finished: response.senders.reduce((finished, sender) => finished && sender.providers[provider[0]].finished, true),
          id: provider[1]['id'],
        };
      }),
      senders: response.senders.map((sender) => {
        return {
          ...this.calculatePercentageOverAll(sender, sender.name),
          finished: sender.finished,
          link: sender.link,
          version: sender.version,
          providers: Object.entries(sender.providers).map((provider) => {
            return {
              ...this.calculatePercentageOverAll(provider[1], provider[0]),
              finished: provider[1]['finished'],
              id: provider[1]['id'],
            };
          }),
        };
      }),
    };
  }

  async getAccount(): Promise<any> {
    return await this.handlerInstance.retrieveGlockAppsAccount();
  }

  async getMessageInfo(id: string): Promise<any> {
    return await this.handlerInstance.getTestMessageInfo(id);
  }

  async getProviders(): Promise<any> {
    return await this.handlerInstance.getTestProviders();
  }

  async createTests(testCreate: TestCreateDto): Promise<Array<TestMessageDto>> {
    return await this.handlerInstance.createTests(testCreate);
  }

  async sendTestMessages(testSendDto: TestCreateDto): Promise<Array<TestAccountDto>> {
    return await this.handlerInstance.sendTestMessage(testSendDto);
  }

  async sendSingleSendGridCustomMessages(testCreateDto: TestMessageDto, createdTest: any): Promise<any> {
    const { SeedList, InsertInBody } = createdTest;
    const formatedMessage = testCreateDto.content.concat(InsertInBody);
    const response = await this.sendGridHandler.sendSingleCustomEmail(
      SeedList,
      testCreateDto.fromName,
      testCreateDto.fromMail,
      testCreateDto.subject,
      formatedMessage,
      testCreateDto.ipPool,
    );

    return response;
  }

  async createSendGridGlockAppsTest(testCreateDto: TestCreateDto, accountName: string): Promise<any> {
    for (const message of testCreateDto.messages) {
      const { data: glockAppsTest } = await this.handlerInstance.doCreate(message.content, testCreateDto.title, message.version, accountName);

      const sent =
        testCreateDto.triggerId == 4 ? await this.sparkPostHandler.sendEmail(message, glockAppsTest) : await this.sendSingleSendGridCustomMessages(message, glockAppsTest);

      return {
        created: glockAppsTest,
        sent,
      };
    }
  }

  async createTest(testCreateDto: TestCreateDto, accountId: number): Promise<any> {
    const account = await this.accountsService.findOne(accountId);
    testCreateDto.messages.forEach((message) => {
      message.audiences =
        testCreateDto.triggerId === ProviderEnum.Sendgrid ? [{ name: 'Glockapps', id: '9ec7ee34-876d-4d50-a359-bfb8a8f3c81b' }] : [{ name: 'Glockapps', id: 1028348366 }];
    });

    if (testCreateDto.triggerId === ProviderEnum.Sendgrid || testCreateDto.triggerId === ProviderEnum.Sparkpost) {
      if (testCreateDto.provider == 'glockApps') {
        return await this.createSendGridGlockAppsTest(testCreateDto, account.name);
      }
    }
  }
}
