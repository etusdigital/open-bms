import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ContactEntity } from 'src/msgops/entities/contact.entity';

@Injectable()
export class ActiveCampaignProvider {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  async createContact(contact: ContactEntity, stepSettings) {
    try {
      const headers = {
        'content-type': 'application/json',
        'Api-Token': `${stepSettings.apiKey}`,
      };
      const payloadContact = {
        contact: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
        },
      };
      const response: any = await lastValueFrom(
        this.httpService.post(`https://${stepSettings.accountName}.api-us1.com/api/3/contacts`, payloadContact, {
          headers,
        }),
      );

      if (response.status === 422 && response.data?.errors?.[0]?.code === 'duplicate') {
        console.log('[ACTIVE-CAMPAIGN] - Contact already exists');
        return;
      }

      if (response.status === 201) {
        const payloadList = {
          contactList: {
            list: stepSettings.list.id,
            contact: response.data.contact.id,
            status: 1,
          },
        };
        await lastValueFrom(
          this.httpService.post(`https://${stepSettings.accountName}.api-us1.com/api/3/contactLists`, payloadList, {
            headers,
          }),
        );
      }
      return response?.data || {};
    } catch (error) {
      if (error && error.message && error.message.includes('code 422')) {
        console.log('[ACTIVE-CAMPAIGN] - Contact already exists');
        return;
      }
      throw new InternalServerErrorException(`[ACTIVE-CAMPAIGN] - Error to send: ${JSON.stringify(error)}`);
    }
  }
}
