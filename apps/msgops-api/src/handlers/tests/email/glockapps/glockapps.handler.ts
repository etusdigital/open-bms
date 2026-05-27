import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { AccountsService } from '../../../../modules/accounts/accounts.service';
import { CampaignsService } from '../../../../modules/campaigns/campaigns.service';
import { TestAccountDto } from '../../../../modules/tests/test-account.dto';
import { TestCreateDto } from '../../../../modules/tests/test-create.dto';
import { TestCreatedDto } from '../../../../modules/tests/test-created.dto';
import { TestMessageDto } from '../../../../modules/tests/test-message.dto';
import { ProviderEnum } from '../interfaces/interface';
import { providersMap } from './providers.map';
import { SendgridHandler } from '../../../email/sendgrid/sendgrid.handler';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class GlockAppsHandler {
  constructor(
    private readonly httpService: HttpService,
    private readonly sendgridHandler: SendgridHandler,
    private readonly accountService: AccountsService,
    private readonly cls: ClsService,
    private readonly campaignService?: CampaignsService,
  ) {}

  async retrieveGlockAppsAccount(): Promise<any> {
    try {
      const apikey = await this.findApiKey();
      const response = await this.httpService
        .get('https://api.glockapps.com/v2/account', {
          params: {
            apikey,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      console.error(error);
      throw new HttpException('Could not retrieve accounts.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTestProviders(): Promise<any> {
    try {
      const apikey = await this.findApiKey();
      const response = await this.httpService
        .get('https://spamtest.glockapps.com/api/v1/GetProviders', {
          params: {
            apikey,
            v: 2,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      console.error(error);
      throw new HttpException('Could not retrieve accounts.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTestMessageInfo(testId: string): Promise<any> {
    try {
      const apikey = await this.findApiKey();
      const response = await this.httpService
        .get('https://spamtest.glockapps.com/api/v1/GetEmailInfo', {
          params: {
            apikey,
            TestID: testId,
          },
        })
        .toPromise();

      return response.data;
    } catch (error) {
      console.error(error);
      throw new HttpException('Could not retrieve accounts.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async sendTestMessage(testSendDto: TestCreateDto): Promise<Array<TestAccountDto>> {
    console.log(`Tracer: Glockapps.sendTestMessage`, JSON.stringify(testSendDto));
    if (!this.campaignService) throw new HttpException("Can't send messages without the campaign service!", HttpStatus.INTERNAL_SERVER_ERROR);

    try {
      testSendDto.messages.forEach((message) => {
        message.accounts.forEach((account) => {
          account.append = `id:${account.testId}`;
        });

        message.silos.forEach((silo) => {
          silo.append = `id:${silo.testId}`;

          if (testSendDto.triggerId === ProviderEnum.Sendgrid) {
            const glockappsSegmentId = '18946f31-ca46-4ddf-9059-ff445955e7cf';
            silo.segments.forEach((segment) => (segment.segmentIdExternal = glockappsSegmentId));
          }
        });
      });

      if (testSendDto.triggerId === ProviderEnum.Sendgrid) {
        return await this.sendgridHandler.sendCampaign(testSendDto);
      }
    } catch (error) {
      console.error(error);
      throw new HttpException('Could not retrieve accounts.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async doCreate(sender: string, title: string, version: number, accountName: string): Promise<AxiosResponse<any>> {
    let providersGlock = '2,3,12,36,34,38,62,20,53,54,69,71,72,78,79,80';
    const changeProviders = ['MejoresOpciones'];
    if (changeProviders.includes(accountName)) {
      providersGlock = `2,3,12,36,4,5,11,37,38,43,99,7,9,10,25,39,42,8,13,14,19,23,26,62,
      65,82,100,15,16,17,20,30,44,45,46,47,48,49,50,51,53,54,55,56,57,58,60,69,
      71,72,73,74,75,78,79,80,101,18,21,22,24,41,28,29,88,32,33,34,35,81`;
    }
    const apikey = await this.findApiKey();
    const url = 'https://spamtest.glockapps.com/api/v1/CreateTest';
    const config = {
      params: {
        apikey,
        groups: 0,
        v: 2,
        subject: title,
        providers: providersGlock,
        note: `Version ${version}`,
      },
    };

    console.log(`Tracer: Glockapps.doCreate`, JSON.stringify(config));
    return await this.httpService.post(url, {}, config).toPromise();
  }

  async doForAccounts(message: TestMessageDto, title: string) {
    console.log(`Tracer: Glockapps.doForAccounts - ${title}`, JSON.stringify(message));

    return message.accounts.map(async (account) => {
      const response = await this.doCreate(account.activeCampaignAccountId, title, message.version, '');

      return (
        response.data && {
          testId: response.data.TestID,
          activeCampaignAccountId: account.activeCampaignAccountId,
          apiKey: account.apiKey,
          version: message.version,
          seedList: response.data.SeedList,
        }
      );
    });
  }

  async doForSilos(message: TestMessageDto, title: string) {
    const glockappsSegment = [{ segmentIdExternal: 'd2ff934e-b60b-4de3-8678-4ba5801a7b2c' }];

    return message.silos.map(async (silo) => {
      const response = await this.doCreate(silo.siloName, title, message.version, '');
      console.log(`Tracer: Glockapps.doForSilos `, JSON.stringify({ silo, response }));

      return (
        response.data && {
          testId: response.data.TestID,
          siloName: silo.siloName,
          version: message.version,
          siloIdExternal: silo.siloIdExternal,
          fromName: silo.fromName,
          fromMail: silo.fromMail,
          percentage: silo.percentage,
          segments: glockappsSegment,
        }
      );
    });
  }

  async createTests(testCreateDto: TestCreateDto): Promise<Array<TestMessageDto>> {
    console.log(`Tracer: Glockapps.createTests `, JSON.stringify({ testCreateDto }));

    try {
      return await Promise.all(
        testCreateDto.messages.map(async (message) => {
          const accounts = await this.doForAccounts(message, testCreateDto.title);
          const silos = await this.doForSilos(message, testCreateDto.title);

          return {
            ...message,

            accounts: message.accounts.length ? await Promise.all(accounts) : [],
            silos: message.silos.length ? await Promise.all(silos) : [],
          };
        }),
      );
    } catch (error) {
      console.error(error);
      throw new HttpException('Could not retrieve accounts.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findApiKey() {
    const account = await this.accountService.findByAccountConfig(this.cls.get('accountId'), 'glock_api_key');
    return account?.value || null;
  }

  private getProperty(type: string): string {
    let property: string;

    if (type === 'X') property = 'missing';
    else if (type === 'Inbox') property = 'inbox';
    else if (type === 'Primary') property = 'inbox';
    else if (type === 'Spam') property = 'spam';
    else property = 'other';

    return property;
  }

  async listResults(testCreateDto: Array<TestCreatedDto>): Promise<any> {
    try {
      const apikey = await this.findApiKey();
      const ids = testCreateDto.map((created) => created.testId);

      const idsStringfied = [];

      for (let i = 0; i < ids.length; i += 49) idsStringfied.push(ids.slice(i, i + 49).toString());

      const promises = [];

      for (let i = 0; i < idsStringfied.length; i++)
        promises.push(
          await this.httpService
            .post(
              'https://spamtest.glockapps.com/api/v1/GetTestsResults',
              {},
              {
                params: {
                  apikey,
                  ids: idsStringfied[i],
                },
              },
            )
            .toPromise(),
        );

      const stats = promises.map((response) => response.data);
      const senderStats = stats.flat().map((result) => {
        const sender = testCreateDto.filter((created) => created.testId === result.TestID)[0];

        return {
          providers: result.Inboxes.filter((inbox) => providersMap.Gmail.includes(inbox.ID)).reduce((obj, inbox) => {
            const property = this.getProperty(inbox.iType);

            obj[inbox.ISP] = {
              [property]: (obj[inbox.ISP] && obj[inbox.ISP][property]++) || 1,
              finished: inbox.finished,
              id: inbox.ID,
            };
            return obj;
          }, {}),
          inbox: result.Stats.Other ? result.Stats.Inbox - 1 : result.Stats.Inbox,
          other: result.Stats.Other,
          missing: result.Stats.NotDelivered,
          spam: result.Stats.Spam,
          finished: result.Finished,
          link: `https://app.glockapps.com/inbox/tests/${sender.testId}/deliverabilty`,
          version: sender.version,
          name: sender.accountId || sender.siloName,
        };
      });

      senderStats.forEach((sender) => {
        sender.providers = Object.entries(sender.providers).reduce(
          (obj, provider) => {
            obj.Gmail = {
              inbox: obj.Gmail.inbox + (provider[1]['inbox'] || 0),
              other: obj.Gmail.other + (provider[1]['other'] || 0),
              missing: obj.Gmail.missing + (provider[1]['missing'] || 0),
              spam: obj.Gmail.spam + (provider[1]['spam'] || 0),
              finished: obj.Gmail.finished && provider[1]['finished'],
            };

            return obj;
          },
          {
            Gmail: {
              inbox: 0,
              missing: 0,
              spam: 0,
              other: 0,
              finished: true,
            },
          },
        );
      });

      const globalStats = senderStats.reduce(
        (obj, sender) => {
          return {
            inbox: obj.inbox + sender.inbox,
            spam: obj.spam + sender.spam,
            other: obj.other + sender.other,
            missing: obj.missing + sender.missing,
            finished: obj.finished && sender.finished,
            providers: {
              Gmail: {
                inbox: obj.providers.Gmail.inbox + sender.providers.Gmail.inbox,
                missing: obj.providers.Gmail.missing + sender.providers.Gmail.missing,
                other: obj.providers.Gmail.other + sender.providers.Gmail.other,
                spam: obj.providers.Gmail.spam + sender.providers.Gmail.spam,
                finished: obj.providers.Gmail.finished && sender.providers.Gmail.finished,
              },
            },
          };
        },
        {
          inbox: 0,
          missing: 0,
          other: 0,
          spam: 0,
          finished: true,
          providers: {
            Gmail: {
              inbox: 0,
              missing: 0,
              other: 0,
              spam: 0,
              finished: true,
            },
          },
        },
      );

      return {
        ...globalStats,
        senders: senderStats,
      };
    } catch (e) {
      console.error(e);
      console.error(`Error Details: ${JSON.stringify(e.response?.data)}`);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
