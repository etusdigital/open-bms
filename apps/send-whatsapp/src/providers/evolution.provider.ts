import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EvolutionProvider {
  private apiUrl: string;
  private instanceName: string;
  private apiKey: string;

  constructor(instanceName: string, apiKey: string) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.apiUrl = process.env.EVOLUTION_API_URL;
    this.instanceName = instanceName;
    this.apiKey = apiKey;
  }

  async sendWhatsappTemplate(messageName: string, language: string, to: string, utms: string, shortCode: string, codeMessage?: string) {
    try {
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      const msgData = {
        number: to.replace('whatsapp:', '').replace('+', ''),
        name: messageName,
        language: language,
        webhookUrl: `${process.env.WHATSAPP_CALLBACK_EVOLUTION}?${utms}`,
        components: undefined,
      };

      if (shortCode) {
        msgData.components = [
          {
            type: 'button',
            sub_type: 'URL',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: shortCode,
              },
            ],
          },
        ];
      }

      if (codeMessage) {
        msgData.components = [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: codeMessage,
              },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              {
                type: 'text',
                text: codeMessage,
              },
            ],
          },
        ];
      }

      const { data } = await axios.post(`${this.apiUrl}/message/sendTemplate/${this.instanceName}`, msgData, {
        headers: {
          apikey: this.apiKey,
        },
      });

      return data;
    } catch (error) {
      console.error(error);
      return error;
    }
  }
}
