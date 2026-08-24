import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendEmailMessageDto, TransactionalMessage } from './services.dto';
import { ServicesService } from './services.service';
import { MessageDto } from '../messages/messages.dto';
import { ValidLinksService } from '../../utils/utils.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('services')
@ApiBearerAuth()
@ApiTags('SERVICES')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly validLinksService: ValidLinksService,
  ) {}

  @Post('/send-email')
  @ApiOperation({ summary: 'Send a email using send-email service' })
  @RequirePermission('messages:test_send')
  async sendEmail(@Body() sendEmailMessageDto: SendEmailMessageDto): Promise<any> {
    const invalidLink = await this.validLinksService.validLinks(sendEmailMessageDto.message.content);
    if (invalidLink.length) {
      throw new HttpException({ status: HttpStatus.BAD_REQUEST, error: `Link inválido no email: ${invalidLink.join(' | ')}` }, HttpStatus.BAD_REQUEST);
    }
    return await this.servicesService.sendEmail(sendEmailMessageDto);
  }

  @Post('/send-mobile-push')
  @ApiOperation({ summary: 'Send a push using send-push service' })
  @RequirePermission('messages:test_send')
  async sendPush(@Body() sendPushMessageDto: { email: string; message: MessageDto }): Promise<any> {
    return await this.servicesService.sendMobilePush(sendPushMessageDto);
  }

  @Post('/send-whatsapp')
  @ApiOperation({ summary: 'Send an approved WhatsApp template to a contact using send-whatsapp service' })
  @RequirePermission('messages:test_send')
  async sendWhatsapp(@Body() payload: { email: string; messageId: number }): Promise<any> {
    return await this.servicesService.sendTestWhatsapp(payload);
  }

  @Post('/send-transactional')
  @ApiOperation({ summary: 'Send transactional automation' })
  @RequirePermission('messages:test_send')
  async sendTransactional(@Body() transactionalMessage: TransactionalMessage): Promise<any> {
    return await this.servicesService.processTransactional(transactionalMessage);
  }

  @Post('/unsubscribed')
  @ApiOperation({ summary: 'Set unsubscribed lead' })
  @RequirePermission('audience:contacts_suppress')
  async unsubscribed(@Body() leadConceptionDto: { email: string }): Promise<any> {
    return await this.servicesService.unsubscribed(leadConceptionDto.email);
  }
}
