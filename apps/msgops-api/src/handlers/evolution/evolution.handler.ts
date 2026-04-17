import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
@Injectable()
export class EvolutionHandler {
  private apiUrl: string;
  private apiKey: string;

  constructor(private readonly httpService: HttpService) {
    this.apiUrl = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
  }

  public async createMessage(message: any, instanceName: string, token: string) {
    try {
      const response = await this.httpService
        .post(`${this.apiUrl}/template/create/${instanceName}`, message, {
          headers: {
            apikey: token,
          },
        })
        .toPromise();
      return response.data;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Create error message!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async createInstance(accountProviders: any) {
    const numberId = accountProviders.find((provider) => provider.name === 'whatsapp_number_id');
    const businessId = accountProviders.find((provider) => provider.name === 'whatsapp_business_id');
    const accessToken = accountProviders.find((provider) => provider.name === 'whatsapp_access_token');
    const instanceName = accountProviders.find((provider) => provider.name === 'whatsapp_number_id');

    if (!numberId || !businessId || !accessToken || !instanceName) {
      return null;
    }

    let findInstance;

    try {
      const { data } = await this.httpService
        .get(`${this.apiUrl}/instance/fetchInstances?instanceName=${instanceName.value}`, {
          headers: {
            apikey: this.apiKey,
          },
        })
        .toPromise();

      if (data.length > 0) {
        findInstance = data[0];
      } else {
        findInstance = null;
      }
    } catch {
      findInstance = null;
    }

    if (findInstance) {
      return findInstance;
    }

    try {
      const response = await this.httpService
        .post(
          `${this.apiUrl}/instance/create`,
          {
            instanceName: instanceName.value,
            token: accessToken.value,
            number: numberId.value,
            businessId: businessId.value,
            qrcode: false,
            integration: 'WHATSAPP-BUSINESS',
          },
          {
            headers: {
              apikey: this.apiKey,
            },
          },
        )
        .toPromise();
      return response.data;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Create error instance!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
