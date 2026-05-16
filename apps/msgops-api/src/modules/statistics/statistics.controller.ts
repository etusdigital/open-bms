import { Controller, Get, Param, Post, Query, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StatisticsUsageDto } from './dto/statistics-usage.dto';
import { DashboardStatisticsDto, StatisticsDto } from './dto/statistics.dto';
import { StatisticsService } from './statistics.service';
import { StatisticsAggregationService } from './statistics.aggregation';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('statistics')
@ApiBearerAuth()
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly statisticsAggregationService: StatisticsAggregationService,
  ) {}

  @ApiOperation({ summary: 'Get dashboard statistics' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/email')
  async dashboard(@Query() params: DashboardStatisticsDto, @Headers('mcp-request') mcpRequest: boolean) {
    return await this.statisticsService.dashboard(params, mcpRequest);
  }

  @ApiOperation({ summary: 'Get statistics messages' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/messages')
  async messages(@Query() params: StatisticsDto) {
    return await this.statisticsService.statisticsMessages(params);
  }

  @RequirePermission('analytics:dashboard_view')
  @Get('/automation/:automationId')
  async automation(@Param('automationId') automationId: number) {
    return await this.statisticsService.getAutomationStatistics(automationId);
  }

  @ApiOperation({ summary: 'Get push statistics' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/push')
  async pushNotification(@Query() params: DashboardStatisticsDto) {
    return await this.statisticsService.pushNotification(params);
  }

  @ApiOperation({ summary: 'Get statistics by campaign and message' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/by-campaign-message')
  async statisticsByCampaignMessage(@Query() params: DashboardStatisticsDto) {
    return await this.statisticsService.statisticsByCampaignMessage(params);
  }

  @ApiOperation({ summary: 'Get push statistics' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/leads')
  async leads(@Query() params: StatisticsDto) {
    return await this.statisticsService.leads(params);
  }

  @ApiOperation({ summary: 'Get account usage' })
  @CronRoute()
  @Post('/usage/:accountId/:date')
  async usage(@Param('accountId') accountId: number, @Param('date') date: string) {
    return await this.statisticsService.findAccountUsage(accountId, date);
  }

  @ApiOperation({ summary: 'Get account usage' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/account-usage')
  async accountUsage(@Query() params: StatisticsUsageDto) {
    const accountIds = Array.isArray(params.accountId) ? params.accountId.map(Number) : params.accountId ? [Number(params.accountId)] : [];
    return await this.statisticsService.getAccountUsage(params, accountIds);
  }

  @ApiOperation({ summary: 'Get account usage (internal service - uses bfp-account-id header)' })
  @CronRoute()
  @Get('/bfp-account-usage')
  async bfpAccountUsage(@Query() params: StatisticsUsageDto, @Headers('bfp-account-id') bfpAccountId: string) {
    return await this.statisticsService.getBfpAccountUsage(params, bfpAccountId);
  }

  @ApiOperation({ summary: 'Get month account usage' })
  @RequirePermission('analytics:dashboard_view')
  @Get('/account-usage/month')
  async getMonthUsage() {
    return await this.statisticsService.getMonthUsage();
  }

  @ApiOperation({ summary: 'Set statistics data on redis' })
  @CronRoute()
  @Get('/set-statistics-redis')
  async exportDataToRedis() {
    return await this.statisticsService.exportDataToRedis();
  }

  @ApiOperation({ summary: 'Load aggregated statistics from redis to postgres' })
  @CronRoute()
  @Get('/aggregated-statistics')
  async loadAggregatedStatistics() {
    // Routed through the service's re-entrancy guard so an external trigger
    // cannot race a concurrent in-process tick and double-write rows.
    await this.statisticsAggregationService.runAggregationCycle();
  }

  @ApiOperation({ summary: 'Load aggregated statistics from redis to postgres' })
  @CronRoute()
  @Get('/aggregated-statistics-backupdate/:date')
  async loadAggregatedStatisticsBackup(@Param('date') date: string) {
    return await Promise.all([this.statisticsAggregationService.transferRedisDataToPostgres(date)]);
  }

  @ApiOperation({ summary: 'Remove old (2 days ago) data from redis, this is used to clean up the redis data' })
  @CronRoute()
  @Get('/remove-old-data-from-redis')
  async removeOldDataFromRedis() {
    return await this.statisticsAggregationService.removeOldDataFromRedis();
  }

  @ApiOperation({ summary: 'Get insights' })
  @RequirePermission('analytics:insights_view')
  @Get('/insights/:period')
  async insights(@Param('period') period: string) {
    return await this.statisticsService.insights(period);
  }
}
