import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LeadMessage, QuizMakerPayload } from './app.interfaces';
import { MsgopsService } from './msgops/msgops.service';
import { PubSubProvider } from './providers/pubsub.provider';
import apps from './hub-apps/apps.json';
import { IncomingHttpHeaders } from 'http';

@Injectable()
export class AppService {
  constructor(
    private readonly msgOpsService: MsgopsService,
    private readonly pubsubProvider: PubSubProvider,
  ) {}

  async process(leadMessage: LeadMessage) {
    const account = await this.msgOpsService.findAccountByApiKey(leadMessage.apiKey);
    if (!account) {
      throw new HttpException('Account not found', HttpStatus.FORBIDDEN);
    }

    if (account.customFieldsKeys) {
      Object.keys(leadMessage).forEach((item) => {
        if (account.customFieldsKeys.includes(item.toLocaleLowerCase())) {
          if (!leadMessage.contact.customFields) {
            leadMessage.contact.customFields = {};
          }
          leadMessage.contact.customFields[item] = leadMessage[item as keyof LeadMessage] as string;
        }
      });
    }

    if (leadMessage.app && (leadMessage as QuizMakerPayload).questions) {
      leadMessage = this.cleanUpQuestions(leadMessage as QuizMakerPayload) as LeadMessage;
    }

    await this.pubsubProvider.sendMessage(leadMessage, { type: 'lead' });

    return {
      status: 200,
      message: `Message published successfully.`,
    };
  }

  async updateContact(leadMessage: LeadMessage) {
    const account = await this.msgOpsService.findAccountByApiKey(leadMessage.apiKey);
    if (!account) {
      throw new HttpException('Account not found', HttpStatus.FORBIDDEN);
    }

    await this.pubsubProvider.sendMessage(leadMessage, { type: 'update' });

    return {
      status: 200,
      message: `Message published successfully.`,
    };
  }

  async parsePayloadQuiz(leadMessage: QuizMakerPayload, headers: IncomingHttpHeaders): Promise<LeadMessage> {
    const name = leadMessage.name?.split(' ') || [''];
    if (!leadMessage.contact) {
      console.error(
        'Invalid payload, missing contact. App: ',
        leadMessage.app,
        ' URL: ',
        leadMessage.source_url,
        ' Payload: ',
        JSON.stringify(leadMessage),
        ' Headers: ',
        JSON.stringify(headers),
      );
      await this.sendSlackWebhook(
        `:warning: Quiz faltando objeto contact: \n *App*: ${leadMessage.app} \n *URL*: ${leadMessage.source_url} \n Origin: ${headers.origin} \n Referer: ${headers.referer} \n *Payload*: \`\`\`${JSON.stringify(leadMessage)}\`\`\`  \n *Headers*: \`\`\`${JSON.stringify(headers)}\`\`\``,
      );
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }

    if (!leadMessage.apiKey || !leadMessage.tagName) {
      await this.sendSlackWebhook(
        `:warning: Quiz precisa de atualizar com apiKey e tagName: \n *App*: ${leadMessage.app} \n *URL*: ${leadMessage.source_url}  \n Origin: ${headers.origin} \n Referer: ${headers.referer} \n *Payload*: \`\`\`${JSON.stringify(leadMessage)}\`\`\`  \n *Headers*: \`\`\`${JSON.stringify(headers)}\`\`\``,
      );
    }

    if (!leadMessage.app || !(leadMessage.app in apps)) {
      await this.sendSlackWebhook(`:pepecringe: App not found: \`\`\`${JSON.stringify(leadMessage)}\`\`\``);
      throw new HttpException('Invalid app in payload quiz', HttpStatus.BAD_REQUEST);
    }

    const appConfig = apps[leadMessage.app as keyof typeof apps] as { apiKey: string; tagName: string };

    return {
      ...leadMessage,
      contact: {
        firstName: name.length ? name[0] : '',
        lastName: name.slice(1).join(' '),
        email: leadMessage.email,
      },
      ...appConfig,
    };
  }

  cleanUpQuestions(leadMessage: QuizMakerPayload): QuizMakerPayload {
    try {
      if (Array.isArray(leadMessage.questions)) {
        return {
          ...leadMessage,
          questions: leadMessage.questions
            .filter((question) => question !== null && question !== undefined)
            .map((question) => {
              if (!question) {
                console.warn('Invalid question format:', question);
                return question; // Skip invalid questions
              }

              if (typeof question !== 'object' || !question.question || !question.answer) {
                console.warn('Invalid question format:', question);
                return question; // Skip invalid questions
              }
              return {
                question: question.question,
                answer: question.answer,
              };
            }),
        };
      }
    } catch (error) {
      console.error('Log - Error cleaning up questions:', error);
    }

    return leadMessage;
  }

  public async sendSlackWebhook(text: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Slack webhook not sent in non-production environment');
      return;
    }

    const payload = {
      text,
      blocks: [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text,
            },
          ],
        },
      ],
    };

    await fetch(process.env.SLACK_WEBHOOK_URL as string, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
