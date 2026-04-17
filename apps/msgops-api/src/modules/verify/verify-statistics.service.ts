import { Injectable } from '@nestjs/common';
import { RedisService } from '../../providers/redis.provider';
import { ClsService } from 'nestjs-cls';
import { VerifyMethod } from './verify.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { VerifyStatisticsEntity } from 'src/entities/verify-statistics.entity';
import { AccountsService } from '../accounts/accounts.service';
import { Redis } from 'ioredis';

dayjs.extend(utc);
dayjs.extend(timezone);

export enum VerifyStatisticType {
  TOTAL = 'count_total',
  SUCCESS = 'count_success',
  ERROR = 'count_error',
  VALIDATED = 'count_verify_validated',
  REJECTED = 'count_verify_rejected',
}

@Injectable()
export class VerifyStatisticsService {
  private readonly redisClient: Redis;

  constructor(
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountsService: AccountsService,
    @InjectRepository(VerifyStatisticsEntity)
    private readonly verifyStatisticsRepository: Repository<VerifyStatisticsEntity>,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  async getStatistics(startDate: string, endDate: string, method: VerifyMethod, group: string | string[]): Promise<any> {
    const accountId = this.cls.get('accountId');
    const today = dayjs().format('YYYY-MM-DD');
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const daysDiff = end.diff(start, 'day');
    if (!group) {
      group = ['default'];
    }

    // If requesting data from today only (single day = today), get from Redis (real-time data)
    if (daysDiff === 0 && startDate === today && endDate === today) {
      return this.getStatisticsFromRedis(startDate, endDate, method, group, accountId);
    }

    // For any other case (yesterday, past dates, or date ranges > 1 day), get from PostgreSQL
    return this.getStatisticsFromDatabase(startDate, endDate, method, group, accountId);
  }

  private async getStatisticsFromRedis(startDate: string, endDate: string, method: VerifyMethod, group: string | string[], accountId: number): Promise<any> {
    const pipeline = this.redisService.getClient().pipeline();

    const dates = [];
    let currentDate = dayjs(startDate);
    const end = dayjs(endDate);

    while (currentDate <= end) {
      dates.push(currentDate.format('YYYY-MM-DD'));
      currentDate = currentDate.add(1, 'day');
    }

    const groups = Array.isArray(group) ? group : [group];

    if (method) {
      dates.forEach((date) => {
        groups.forEach((group) => {
          const key = `2fa_${method.toUpperCase()}_${group}_${accountId}_${date}`;
          pipeline.hgetall(key);
        });
      });
    } else {
      dates.forEach((date) => {
        Object.values(VerifyMethod).forEach((method) => {
          groups.forEach((group) => {
            const key = `2fa_${method.toUpperCase()}_${group}_${accountId}_${date}`;
            pipeline.hgetall(key);
          });
        });
      });
    }

    const results = await pipeline.exec();
    const formattedResults = [];
    let resultIndex = 0;

    for (const date of dates) {
      if (method) {
        groups.forEach((group) => {
          const stats = results[resultIndex][1] || {};
          formattedResults.push({
            date,
            method: method.toUpperCase(),
            group,
            ...this.formatStatistics(stats),
          });
          resultIndex++;
        });
      } else {
        Object.values(VerifyMethod).forEach((method) => {
          groups.forEach((group) => {
            const stats = results[resultIndex][1] || {};
            formattedResults.push({
              date,
              method: method.toUpperCase(),
              group,
              ...this.formatStatistics(stats),
            });
            resultIndex++;
          });
        });
      }
    }
    return formattedResults;
  }

  private async getStatisticsFromDatabase(startDate: string, endDate: string, method: VerifyMethod, group: string | string[], accountId: number): Promise<any> {
    const whereConditions: any = {
      accountId,
      date: Between(startDate, endDate),
    };

    if (method) {
      whereConditions.type = method.toUpperCase();
    }

    if (Array.isArray(group)) {
      whereConditions.group = In(group);
    } else {
      whereConditions.group = group;
    }

    const entities = await this.verifyStatisticsRepository.find({
      where: whereConditions,
      order: {
        date: 'DESC',
        type: 'ASC',
      },
    });

    // Convert entities to match expected format
    const results = entities.map((entity) => ({
      date: entity.date.toString(),
      method: entity.type,
      group: entity.group,
      count_total: (entity.countTotal || 0).toString(),
      count_success: (entity.countSuccess || 0).toString(),
      count_error: (entity.countError || 0).toString(),
      count_verify_validated: (entity.countVerifyValidated || 0).toString(),
      count_verify_rejected: (entity.countVerifyRejected || 0).toString(),
    }));

    // Generate complete date range with all methods, filling missing data with zeros
    const dates = [];
    let currentDate = dayjs(startDate);
    const end = dayjs(endDate);

    while (currentDate <= end) {
      dates.push(currentDate.format('YYYY-MM-DD'));
      currentDate = currentDate.add(1, 'day');
    }

    const formattedResults = [];
    const methods = method ? [method.toUpperCase()] : Object.values(VerifyMethod);

    // Get all unique groups from results if group is null
    const groups = [...new Set(results.map((r) => r.group))];

    dates.forEach((date) => {
      methods.forEach((methodType) => {
        groups.forEach((groupValue) => {
          const existing = results.find((r) => r.date === date && r.method === methodType && r.group === groupValue);

          if (existing) {
            formattedResults.push({
              date,
              method: methodType.toUpperCase(),
              group: groupValue,
              count_total: parseInt(existing.count_total) || 0,
              count_success: parseInt(existing.count_success) || 0,
              count_error: parseInt(existing.count_error) || 0,
              count_verify_validated: parseInt(existing.count_verify_validated) || 0,
              count_verify_rejected: parseInt(existing.count_verify_rejected) || 0,
            });
          } else {
            // Fill missing data with zeros
            formattedResults.push({
              date,
              method: methodType.toUpperCase(),
              group: groupValue,
              count_total: 0,
              count_success: 0,
              count_error: 0,
              count_verify_validated: 0,
              count_verify_rejected: 0,
            });
          }
        });
      });
    });

    return formattedResults;
  }

  private formatStatistics(stats: any): any {
    const defaultStats = {
      count_total: 0,
      count_success: 0,
      count_error: 0,
      count_verify_validated: 0,
      count_verify_rejected: 0,
    };

    const formattedStats = { ...defaultStats };

    Object.keys(stats).forEach((key) => {
      if (Object.values(VerifyStatisticType).includes(key as VerifyStatisticType)) {
        formattedStats[key] = parseInt(stats[key]) || 0;
      }
    });
    return formattedStats;
  }

  async incrementStatistic(method: VerifyMethod, group: string, statisticType: VerifyStatisticType, timeZone = 'UTC'): Promise<void> {
    const accountId = this.cls.get('accountId');
    const currentDate = dayjs().tz(timeZone).format('YYYY-MM-DD');

    //Key format: 2fa_<method>_<group>_<accountId>_<date>
    const statisticKey = `2fa_${method.toUpperCase()}_${group}_${accountId}_${currentDate}`;

    const pipeline = this.redisService.getClient().pipeline();
    pipeline.hincrby(statisticKey, statisticType, 1);
    pipeline.expire(statisticKey, 60 * 60 * 36); // 36 hours

    try {
      await pipeline.exec();
    } catch (error) {
      console.error(`Error incrementing 2FA statistics: ${error}`);
    }
  }
}
