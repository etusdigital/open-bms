import { Injectable, NotFoundException } from '@nestjs/common';
import { SlackService } from './services/slack.service';
import { KnownBlock } from '@slack/web-api';
import { InjectRepository } from '@nestjs/typeorm';
import { WarmupUserEntity } from './entities/warmup-user.entity';
import { In, Repository } from 'typeorm';
import { Message, NotifyPayload } from './interfaces';

@Injectable()
export class AppService {
  constructor(
    readonly slackService: SlackService,
    @InjectRepository(WarmupUserEntity)
    private warmupUserRepository: Repository<WarmupUserEntity>
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async notify(data: NotifyPayload): Promise<any> {
    if (!data) {
      return;
    }

    this.logInfo(`payload: ${JSON.stringify(data)}`);

    const { recipients } = data;

    const internalUsers = await this.warmupUserRepository.find({
      where: {
        isInternal: true,
        email: In(recipients.map(recipient => recipient.email)),
      },
    });

    if (!internalUsers.length) {
      throw new NotFoundException('No internal users found');
    }

    try {
      for (const user of internalUsers) {
        const payload = this.parsePayload(data.message, user);
        this.logInfo(`slackMessage: ${JSON.stringify(payload)}`);
        await this.slackService.sendMessage(payload);
      }
    } catch (error) {
      return error;
    }

    return { ok: true };
  }

  parsePayload(message: Message, recipient: WarmupUserEntity) {
    const search = `${message.email} ${this.removePlaceholders(message.subject)}`;
    const encodedSearch = encodeURIComponent(search).replace(/%20/g, '+');

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Olá ${recipient.name}👋. Acabei de te enviar mais um email. Segue os dados:`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Assunto: ${this.removePlaceholders(message.subject)}\nSender: ${message.email}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Segue link para abrir seu Gmail já com a busca desse email:',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Abrir Gmail',
            emoji: true,
          },
          style: 'primary',
          value: 'click_me_123',
          url: `https://mail.google.com/mail?authuser=${recipient.email}#search/in%3Aall+${encodedSearch}`,
          action_id: 'button-action',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `No momento nosso link só funciona para desktop. Se deseja abrir o email em seu dispositivo mobile favor buscar manualmente pelo email.`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '‼️ Não se esqueça de marcar que "NÃO É SPAM"\n 👀 Importante abrir o email e aguardar alguns segundos para simular leitura.\n❓Em caso de dúvidas postar no canal #proj-warm-up',
          },
        ],
      },
    ];

    return {
      userId: recipient.slackId,
      blocks: blocks,
      text: `Acabei de enviar a mensagem ${message.subject} de ${message.email} - Segue link do gmail para facilitar: https://mail.google.com/mail/u/0/#search/in%3Aall+${encodedSearch}`,
    };
  }

  logInfo(dsc: string, args?: string) {
    const logLevel = process.env.LOG_LEVEL || 'INFO';
    if (logLevel === 'INFO' || logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }

  removePlaceholders(input: string): string {
    return input.replace(/%[A-Z_]+%/g, '');
  }
}
