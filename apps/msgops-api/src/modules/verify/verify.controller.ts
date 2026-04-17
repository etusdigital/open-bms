import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VerifyDto, VerifyGenerateResponse, VerifyStatisticsResponse, VerifyValidateDto, VerifyValidateResponse } from './dto/verify.dto';
import { VerifyMethod } from './verify.interface';
import { VerifyStatisticsService } from './verify-statistics.service';
import { VerifyService } from './verify.service';
import { Request } from 'express';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('verify')
@ApiBearerAuth()
@ApiTags('VERIFY')
export class VerifyController {
  constructor(
    private readonly verifyService: VerifyService,
    private readonly verifyStatisticsService: VerifyStatisticsService,
  ) {}

  @ApiOperation({ summary: 'Generate 2FA code and send to user' })
  @ApiResponse({ status: 201, description: 'Code generated and sent to user', type: VerifyGenerateResponse })
  @RequirePermission('account:settings_update')
  @Post('/generate')
  async generate(@Body() payload: VerifyDto, @Req() request: Request): Promise<VerifyGenerateResponse> {
    return await this.verifyService.generate(payload, request);
  }

  @ApiOperation({ summary: 'Validates provided code' })
  @ApiResponse({ status: 201, description: 'Returns if code is valid or not.', type: VerifyValidateResponse })
  @RequirePermission('account:settings_update')
  @Post('/validate')
  async validate(@Body() payload: VerifyValidateDto): Promise<VerifyValidateResponse> {
    return await this.verifyService.validate(payload);
  }

  @ApiOperation({ summary: 'Get 2FA statistics for a date range' })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)', example: '2023-07-07', type: String, required: true })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)', example: '2023-07-07', type: String, required: true })
  @ApiQuery({ name: 'method', description: 'Method used to send the verification code', example: 'SMS', type: String, enum: VerifyMethod })
  @ApiQuery({ name: 'group', description: 'Group to get statistics for', example: 'default', type: [String], isArray: true, required: true })
  @ApiResponse({ status: 200, description: 'Returns 2FA statistics for the date range', type: [VerifyStatisticsResponse] })
  @RequirePermission('account:settings_view')
  @Get('/statistics')
  async getStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('method') method: VerifyMethod,
    @Query('group') group: string | string[],
  ): Promise<VerifyStatisticsResponse[]> {
    return await this.verifyStatisticsService.getStatistics(startDate, endDate, method, group);
  }
}
