import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewSenderDto } from './new-sender.dto';
import { SenderPageDto } from './sender-page.dto';
import { SendersDto, SyncResultDto } from './senders.dto';
import { SendersService } from './senders.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('senders')
@ApiBearerAuth()
@ApiTags('CRUD')
export class SendersController {
  constructor(private readonly sendersService: SendersService) {}

  @ApiOperation({ summary: 'Get all senders' })
  @RequirePermission('infra:pools_read')
  @Get()
  async list(@Query() params: SenderPageDto) {
    if (!params.itemsPerPage) {
      return await this.sendersService.listAll(params);
    }
    return await this.sendersService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Sync verified senders from SendGrid' })
  @RequirePermission('infra:manage')
  @Post('/sync')
  async sync(): Promise<SyncResultDto> {
    return await this.sendersService.syncFromSendgrid();
  }

  @ApiOperation({ summary: 'Get sender by ID' })
  @RequirePermission('infra:pools_read')
  @Get('/:id')
  async findOneById(@Param('id') id: number) {
    return this.sendersService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create new sender' })
  @RequirePermission('infra:manage')
  @Post()
  async create(@Body() senderDto: NewSenderDto) {
    return await this.sendersService.create(senderDto);
  }

  @ApiOperation({ summary: 'Edit sender' })
  @RequirePermission('infra:manage')
  @Put('/:id')
  async edit(@Param('id') id: number, @Body() senderDto: SendersDto) {
    if (!id) throw new HttpException("Can't update a sender without id.", HttpStatus.BAD_REQUEST);
    senderDto.id = id;
    return await this.sendersService.edit(senderDto);
  }

  @ApiOperation({ summary: 'Delete sender' })
  @RequirePermission('infra:manage')
  @Delete('/:id')
  async delete(@Param('id') id: number): Promise<void> {
    if (!id) throw new HttpException("Can't delete a sender without id.", HttpStatus.BAD_REQUEST);
    await this.sendersService.delete(id);
  }
}
