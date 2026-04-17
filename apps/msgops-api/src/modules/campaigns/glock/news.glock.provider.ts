import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EmailTemplateDto } from '../email/email-template.dto';

interface GlockTest {
  createResult: any;
  emailTemplate: EmailTemplateDto;
}

@Injectable()
export class GlockProvider {
  constructor(private readonly httpService: HttpService) {}

  private readonly apiKey: string = process.env.GLOCK_API_KEY;
  private readonly spamTestUrl: string = 'https://spamtest.glockapps.com/api/v1';

  async createTests(emailTemplates: EmailTemplateDto[]): Promise<GlockTest[]> {
    try {
      const promises = emailTemplates.map(async (template) => {
        const config = {
          params: {
            apikey: this.apiKey,
            groups: 0,
            v: 2,
            subject: template.title,
            providers:
              '2,3,12,36,4,5,11,37,38,43,99,7,9,25,39,42,8,19,23,26,62,65,82,' +
              '100,15,16,17,20,30,44,45,46,47,48,49,51,53,54,55,56,57,58,60,69,' +
              '71,72,73,74,75,78,79,80,101,18,22,24,41,28,29,88,32,33,34,35,81',
          },
        };

        return await this.httpService.post(`${this.spamTestUrl}/CreateTest`, {}, config).toPromise();
      });

      const results = await Promise.all(promises);
      return results.map((result, index) => {
        return {
          createResult: result.data,
          emailTemplate: {
            ...emailTemplates[index],
            isTested: true,
            testId: result.data.TestID,
          },
        };
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Failed to create tests for templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // @Cleanup: This would be better in a sendgrid provider as 'createEmailsFromGlockTest', but we are
  // leaving it here for now since it doesn't need any imports that would pollute the glock provider.
  createSendgridEmailsFromCreateResults(results: GlockTest[]): any[] {
    return results.map((result) => {
      return {
        to: result.createResult.SeedList,
        from: result.emailTemplate.fromMail,
        subject: result.emailTemplate.subject,
        html: result.createResult.TestID + '\n' + result.emailTemplate.content,
        headers: {
          'X-API-Campaign-id': result.createResult.TestID,
        },
      };
    });
  }

  async getTestResults(testId: string): Promise<any> {
    try {
      const config = {
        params: {
          apikey: this.apiKey,
          TestID: testId,
        },
      };
      const result = await this.httpService.get(`${this.spamTestUrl}/GetTestResult`, config).toPromise();
      return result.data;
    } catch (e) {
      console.error(e);
      throw new HttpException('Failed to get test results.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getBatchTestResults(testIds: string[]): Promise<any[]> {
    try {
      const config = {
        params: {
          apikey: this.apiKey,
          ids: testIds.join(),
        },
      };
      const result = await this.httpService.post(`${this.spamTestUrl}/GetTestsResults`, {}, config).toPromise();
      return result.data;
    } catch (e) {
      console.error(e);
      throw new HttpException('Failed to get test results.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
