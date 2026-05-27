import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWhatsappChannelDto } from './dtos/create-channel.dto';
import { WhatsappChannelsService, type ChannelSummary } from './whatsapp-channels.service';

@Controller('accounts/:accountId/whatsapp-channels')
@ApiBearerAuth()
@ApiTags('WhatsApp Channels')
export class WhatsappChannelsController {
  constructor(private readonly service: WhatsappChannelsService) {}

  @Get()
  @ApiOperation({ summary: 'List WhatsApp channels of the account' })
  list(@Param('accountId', ParseIntPipe) accountId: number): Promise<ChannelSummary[]> {
    return this.service.list(accountId);
  }

  @Get(':channelId')
  @ApiOperation({ summary: 'Get a single WhatsApp channel by id (used for polling status)' })
  get(@Param('accountId', ParseIntPipe) accountId: number, @Param('channelId', ParseIntPipe) channelId: number): Promise<ChannelSummary> {
    return this.service.get(accountId, channelId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a WhatsApp channel (mode discriminates Meta direct vs EvoHub)' })
  create(@Param('accountId', ParseIntPipe) accountId: number, @Body() payload: CreateWhatsappChannelDto): Promise<ChannelSummary> {
    return this.service.create(accountId, payload);
  }

  @Get('hub-channels/available')
  @ApiOperation({ summary: 'List EvoHub channels accessible by the configured API key (for the "attach existing" picker)' })
  listHubChannels(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.service.listHubChannels(accountId);
  }

  @Post('attach-existing')
  @ApiOperation({ summary: 'Attach BMS to an existing EvoHub channel — creates only the webhook, skips Embedded Signup' })
  attachExisting(@Param('accountId', ParseIntPipe) accountId: number, @Body() payload: { hubChannelId: string; name?: string }): Promise<ChannelSummary> {
    return this.service.attachToExistingHubChannel(accountId, payload);
  }

  @Delete(':channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect / delete a WhatsApp channel (best-effort Hub cleanup if mode=evohub)' })
  async delete(@Param('accountId', ParseIntPipe) accountId: number, @Param('channelId', ParseIntPipe) channelId: number): Promise<void> {
    await this.service.delete(accountId, channelId);
  }
}
