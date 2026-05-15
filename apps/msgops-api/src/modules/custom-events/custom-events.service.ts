import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { PaginationDto } from '../../dtos/pagination.dto';
import { CustomEventEntity } from '../../entities/custom-event.entity';
import { EventsLogEntity } from '../../entities/events-log.entity';
import { CustomEventDto } from './dto/custom-event.dto';
import { RedisService } from '../../providers/redis.provider';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { CustomEventsPageDto } from './dto/custom-events-page.dto';
import { AccountsService } from '../accounts/accounts.service';
import { AccountCacheService } from '../accounts/account-cache.service';
import dayjs from 'dayjs';
@Injectable()
export class CustomEventService {
  constructor(
    @InjectRepository(CustomEventEntity)
    private readonly customEventRepository: Repository<CustomEventEntity>,
    @InjectRepository(EventsLogEntity)
    private readonly eventsLogRepository: Repository<EventsLogEntity>,
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountService: AccountsService,
    private readonly accountCacheService: AccountCacheService,
  ) {}

  async listPaginated(params: CustomEventsPageDto): Promise<PaginationDto<CustomEventDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'created_at';
      const order = params.order ? params.order : 'DESC';

      const customEventsQuery = await this.customEventRepository
        .createQueryBuilder('custom_events')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`custom_events.${sortBy}`, `${order}`);

      if (params.title) {
        customEventsQuery.andWhere(`(custom_events.name iLike :search OR custom_events.description iLike :search)`, {
          search: `%${params.title}%`,
        });
      }
      const [results, total] = await customEventsQuery.getManyAndCount();

      // load statistics 7 days
      const pipeline = this.redisService.getClient().pipeline();
      const lastSevenDays: string[] = [];
      const timezone = await this.accountService.getTimezone();
      for (let i = 7; i >= 0; i--) {
        lastSevenDays.push(dayjs().subtract(i, 'day').tz(timezone).format('YYYY-MM-DD'));
      }

      results.forEach((result) => {
        pipeline.get(`statistics:${this.cls.get('accountId')}:custom_events:${result.id}:last_occurrence`);
      });

      const statistics = await pipeline.exec();
      for (const [index, result] of results.entries()) {
        const lastOccurrence = statistics[index][1] ? new Date(Number(statistics[index][1])) : null;
        const stats = { last_occurrence: lastOccurrence, days: [], total: 0, unique: 0 };

        let totalCount = 0;
        let totalUnique = 0;
        const data = await this.statisticsCustomEvents(result.id, lastSevenDays[0], lastSevenDays[lastSevenDays.length - 1]);
        stats.days = data;

        for (const day of data) {
          totalCount += Number(day.events_count) || 0;
          totalUnique += Number(day.events_unique) || 0;
        }

        stats.total = totalCount;
        stats.unique = totalUnique;

        result.statistics = stats;
      }

      return new PaginationDto<CustomEventDto>({
        results: results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<CustomEventEntity> {
    try {
      return await this.customEventRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(customEventsDto: CustomEventDto, accountId?: number): Promise<CustomEventEntity> {
    try {
      customEventsDto.accountId = accountId ? accountId : this.cls.get('accountId');

      const customEventDto = this.customEventRepository.create(customEventsDto);
      const customEvent = await this.customEventRepository.save(customEventDto);
      const redisClient = await this.redisService.getClient();
      const expireIn7Days = 60 * 60 * 24 * 7;
      await redisClient.set(`custom_event:${customEvent.accountId}:${customEvent.name}`, JSON.stringify(customEvent), 'EX', expireIn7Days);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(customEvent.accountId);

      return customEvent;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('CustomEvent with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id: number, customEventDto: CustomEventDto): Promise<CustomEventEntity> {
    try {
      const customEvent = await this.customEventRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });

      const oldNameValue = customEventDto.name !== customEvent.name ? `${customEvent.name}` : null;
      this.customEventRepository.merge(customEvent, customEventDto);
      await this.customEventRepository.update(id, customEvent);

      if (oldNameValue) {
        const redisClient = await this.redisService.getClient();
        const expireIn7Days = 60 * 60 * 24 * 7;
        await redisClient.del(`custom_event:${customEvent.accountId}:${oldNameValue}`);
        await redisClient.set(`custom_event:${customEvent.accountId}:${customEvent.name}`, JSON.stringify(customEvent), 'EX', expireIn7Days);
      }

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(customEvent.accountId);

      return customEvent;
    } catch (error) {
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('CustomEvent with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: number) {
    const customEvent = await this.customEventRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    try {
      if (customEvent.isDefault) {
        throw new ForbiddenException('CustomEvent is the account default');
      }
      const oldName = `${customEvent.name}`;
      const redisClient = await this.redisService.getClient();
      customEvent.name = `${customEvent.name}-deleted-${customEvent.id}`;
      customEvent.deletedAt = new Date();
      await this.customEventRepository.save(customEvent);
      await redisClient.del(`custom_event:${customEvent.accountId}:${oldName}`);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(customEvent.accountId);

      return customEvent;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAccountWithCustomEvents(): Promise<{ accountId: number }[]> {
    return this.customEventRepository.createQueryBuilder('customEvent').select('DISTINCT(customEvent.accountId)', 'accountId').where('customEvent.deletedAt IS NULL').getRawMany();
  }

  async statisticsCustomEvents(customEventId: number, startDate: string, endDate: string) {
    const query = `select * from events_statistics 
      where account_id = ${this.cls.get('accountId')} 
        and event_id = ${customEventId} 
        and date between '${startDate}' and '${endDate}'`;
    return this.customEventRepository.query(query);
  }

  async loadLogs(customEventId: number, params: any): Promise<EventsLogEntity[]> {
    try {
      const { page = 1, itemsPerPage = 1000 } = params;
      const timezone = await this.accountService.getTimezone();
      const startDate = dayjs().subtract(3, 'hour').tz(timezone).format('YYYY-MM-DD HH:mm:ss');
      const endDate = dayjs().tz(timezone).format('YYYY-MM-DD HH:mm:ss');

      const customEvent = await this.customEventRepository.findOneOrFail({ where: { id: customEventId, accountId: this.cls.get('accountId') } });

      return this.eventsLogRepository.find({
        where: { accountId: this.cls.get('accountId'), event: customEvent.name, time: Between(new Date(startDate), new Date(endDate)) },
        take: itemsPerPage,
        skip: (page - 1) * itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
