import { AutomationsFiltersDto } from './automations-filters.dto';
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  HttpException,
  HttpStatus,
  UseInterceptors,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutomationDto } from './automation.dto';
import { AutomationsService } from './automations.service';
import { PaginationDto } from '../../dtos/pagination.dto';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { StatisticsDto } from './dto/statistics.dto';
import { FormatterUtils } from '../../utils/pubSub/formatter.utils';
import { PubSubMessage } from '../../utils/pubSub/interfaces';
import { ClsService } from 'nestjs-cls';
import { StatisticsTargetDto } from './dto/statistics.dto';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('automations')
@ApiBearerAuth()
@ApiTags('CRUD')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly formatterUtils: FormatterUtils,
    private readonly cls: ClsService,
  ) {}

  @ApiOperation({ summary: 'Get all automations' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('automations:view')
  @Get()
  async list(@Query() params: AutomationsFiltersDto): Promise<PaginationDto<AutomationDto> | Array<AutomationDto>> {
    const accountId = this.cls.get('accountId');
    if (params.page && params.itemsPerPage) {
      return await this.automationsService.listPaginated({ ...params, ...{ accountId: accountId } });
    }

    return await this.automationsService.listAll({ ...params, ...{ accountId: accountId } });
  }

  @ApiOperation({ summary: 'Validate if automation name already exists.' })
  @RequirePermission('automations:view')
  @Get('/validate-name')
  async validateNames(@Query() params: AutomationsFiltersDto) {
    return this.automationsService.validateNames(params);
  }

  @ApiOperation({
    summary: 'Create a new automation with steps and conditions if exists',
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('automations:create')
  @Post('/complete')
  async createComplete(
    @Body() automatioDto: AutomationDto,
    @Headers('User-Agent') userAgent?: string,
    @IpAddress() ipAddress?: string,
  ): Promise<AutomationDto | { stepError: number; messageError: string }> {
    try {
      const duplicated = await this.automationsService.validUniqueTitle(automatioDto.title, 0);
      if (duplicated) {
        throw new HttpException(
          {
            status: HttpStatus.CONFLICT,
            error: 'Nome duplicado. Tente novamente um nome não cadastrado anteriormente.',
          },
          HttpStatus.CONFLICT,
        );
      }

      const isInternal = this.cls.get('isInternalAccount');
      const titleLength = isInternal ? 25 : 40;
      if (automatioDto.title.length > titleLength) {
        throw new ForbiddenException('Automation title cannot be longer than ' + titleLength + ' characters');
      }

      const currentUser = this.cls.get('userId');
      return await this.automationsService.createComplete(automatioDto, currentUser, ipAddress, userAgent);
    } catch (error) {
      throw new HttpException(error?.message || 'Internal Server Error', error?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @ApiOperation({
    summary: 'Update an existing automation with steps and conditions if exists',
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('automations:update')
  @Put('/complete')
  async updateComplete(
    @Body() automatioDto: AutomationDto,
    @Headers('User-Agent') userAgent?: string,
    @IpAddress() ipAddress?: string,
  ): Promise<AutomationDto | { stepError: number; messageError: string }> {
    const currentAutomation = await this.automationsService.findOneById(automatioDto.id);
    if (automatioDto.updatedAt < currentAutomation.updatedAt) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'A versão enviada está desatualizada. Recarregue a página e tente novamente.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const duplicated = await this.automationsService.validUniqueTitle(automatioDto.title, automatioDto.id);
    if (duplicated) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Nome duplicado. Tente novamente um nome não cadastrado anteriormente.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const isInternal = this.cls.get('isInternalAccount');
    const titleLength = isInternal ? 25 : 40;
    if (automatioDto.title.length > titleLength) {
      throw new ForbiddenException('Automation title cannot be longer than ' + titleLength + ' characters');
    }

    const currentUser = this.cls.get('userId');
    return await this.automationsService.updateComplete(automatioDto, currentUser, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Delete an automation' })
  @RequirePermission('automations:delete')
  @Delete('/:id')
  async delete(@Param('id') id: number, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string) {
    const currentUser = this.cls.get('userId');
    return await this.automationsService.deleteOneById(id, currentUser, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Changes part of an automation' })
  @RequirePermission('automations:update')
  @Patch('/:id')
  async patch(@Param('id') id: number, @Body() automationDto: AutomationDto) {
    return await this.automationsService.updatePart(id, automationDto);
  }

  @ApiOperation({ summary: 'Make a copy of an automation' })
  @RequirePermission('automations:create')
  @Post('/:id/copy')
  async duplicateAutomation(@Param('id') id: number): Promise<AutomationDto> {
    return await this.automationsService.createCopy(id);
  }

  @ApiOperation({ summary: 'Get automation by TAG' })
  @RequirePermission('automations:view')
  @Get('/tags/:tags')
  async getByTag(@Param('tags') tags: string): Promise<AutomationDto[]> {
    return this.automationsService.getByTag(tags);
  }

  @RequirePermission('automations:view')
  @Get('message/statistics')
  async getStatisticsMessage(@Query() params: StatisticsDto): Promise<any> {
    return await this.automationsService.getStatisticsMessage(params);
  }

  @RequirePermission('automations:view')
  @Get('target/statistics')
  async getStatisticsTarget(@Query() params: StatisticsTargetDto): Promise<any> {
    return await this.automationsService.getStatisticsTarget(params);
  }

  @ApiOperation({ summary: 'Started testab step.' })
  @CronRoute()
  @Post('/started-testab')
  async startedTestAbStep(@Body() data) {
    const params = 'subscription' in (data as PubSubMessage) ? this.formatterUtils.parseBatch(data as PubSubMessage) : (data as any);
    return this.automationsService.startedTestabStep(params);
  }

  @ApiOperation({ summary: 'Finish testab step.' })
  @CronRoute()
  @Post('/finish-testab')
  async finishTestAbStep(@Body() params) {
    return this.automationsService.finishTestabStep(params);
  }

  @ApiOperation({ summary: 'Stop testab step.' })
  @RequirePermission('infra:manage')
  @Post('/stop-testab')
  async stopTestAbStep(@Body() params) {
    return this.automationsService.stopTestAb(params);
  }

  @ApiOperation({ summary: 'Test http request step.' })
  @RequirePermission('automations:test')
  @Post('/http-request-test')
  async sentTestHttpStep(@Body() params) {
    return this.automationsService.sentTestHttpStep(params);
  }

  @ApiOperation({ summary: 'Get active campaigns lists.' })
  @RequirePermission('automations:view')
  @Get('/active-campaign-lists')
  async getListsActiveCampaign(@Query() params) {
    return this.automationsService.getListsActiveCampaign(params);
  }

  @RequirePermission('messages:view')
  @Get('/messages-name')
  redirectMessageName(@Res() res) {
    return res.redirect(`/messages/messages-name`);
  }

  @RequirePermission('messages:view')
  @Get('/messages-all')
  redirectMessageAll(@Res() res) {
    return res.redirect(`/messages/messages-all`);
  }

  @RequirePermission('messages:view')
  @Get('key-name/:date')
  redirectKeyName(@Res() res, @Param('date') date: string) {
    return res.redirect(`/messages/key-name/${date}`);
  }

  @ApiOperation({ summary: 'Get automation by ID' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('automations:view')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<AutomationDto> {
    return await this.automationsService.findOneById(id);
  }
}
