import ApiService from '@/services/api.service';
import { SendEmailMessageDto } from '../dtos/send-email.dto';
import { SendMobilePushMessageDto } from '../dtos/send-mobile-push.dto';

export default class ServicesService {
  private api = new ApiService();

  async sendEmail(sendEmailMessageDto: SendEmailMessageDto) {
    const api = await this.api.getApi();
    return await api.post(`services/send-email`, sendEmailMessageDto);
  }

  async sendMobilePush(sendPushlMessageDto: SendMobilePushMessageDto) {
    const api = await this.api.getApi();
    return await api.post(`services/send-mobile-push`, sendPushlMessageDto);
  }
}
