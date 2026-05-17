import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../../providers/redis.provider';
import { In, Repository } from 'typeorm';
import { PoolEntity } from '../../entities/pool.entity';
import { PoolsDto } from './pools.dto';
import { PoolPageDto } from './pool-page.dto';
import { NewPoolsDto } from './new-pool.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { SendgridHandler } from './../../handlers/email/sendgrid/sendgrid.handler';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PoolsService {
  private readonly logger = new Logger(PoolsService.name);

  constructor(
    @InjectRepository(PoolEntity)
    private readonly poolRepository: Repository<PoolEntity>,
    private readonly redisService: RedisService,
    private readonly sendGridHandler: SendgridHandler,
    private readonly cls: ClsService,
  ) {}

  async delete(id: number): Promise<void> {
    try {
      const pool = await this.poolRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });

      pool.name = `${pool.name}-deleted`;
      pool.deletedAt = new Date();
      await this.poolRepository.save(pool);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async edit(poolDto: PoolsDto): Promise<PoolsDto> {
    const pool = await this.poolRepository.findOneOrFail({
      where: { id: poolDto.id, accountId: this.cls.get('accountId') },
    });

    try {
      this.poolRepository.merge(pool, poolDto);
      await this.poolRepository.update(pool.id, pool);
      return pool;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Pool with that name already exists');
      }

      throw new HttpException(error.response || 'Internal Server Error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(poolDto: NewPoolsDto, accountId?: number): Promise<PoolsDto> {
    poolDto.accountId = accountId ? accountId : this.cls.get('accountId');

    try {
      const pool = this.poolRepository.create(poolDto);
      const saved = await this.poolRepository.save(pool);

      return saved;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Pool with that name already exists');
      }

      throw new HttpException(error.response || 'Internal Server Error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: PoolPageDto): Promise<PaginationDto<PoolEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'createdAt';
      const order = params.order ? params.order : 'ASC';
      const poolQuery = await this.poolRepository
        .createQueryBuilder('pools')
        .where('account_id = :accountId', { accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`pools.${sortBy}`, `${order}`);

      if (params.name) {
        poolQuery.andWhere(`(pools.name iLike :search OR pools.description iLike :search OR pools.pool_name iLike :search)`, {
          search: `%${params.name}%`,
        });
      }

      const [results, total] = await poolQuery.getManyAndCount();

      return new PaginationDto<PoolEntity>({
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

  async listAll(params: PoolPageDto): Promise<Array<PoolEntity>> {
    try {
      // TODO: Restrict access for super-admins only
      const accountId = params.accountId || this.cls.get('accountId');

      return await this.poolRepository.find({
        where: { accountId },
        order: { createdAt: 'DESC' },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<PoolsDto> {
    try {
      return await this.poolRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneByPool(poolName: string, accountId: number): Promise<PoolsDto> {
    return await this.poolRepository.findOne({ where: { poolName, accountId } });
  }

  async getPoolsSendgrid() {
    // SendGrid is optional in OSS. If the account has no key, or the key is
    // invalid / network is down, return an empty list so the operator-facing
    // page still loads. Surface the cause via Logger for diagnostics.
    try {
      return await this.sendGridHandler.getSiloOptions();
    } catch (e) {
      this.logger.warn(`SendGrid pool list unavailable: ${e?.response?.status ?? ''} ${e?.message ?? e}`);
      return [];
    }
  }

  async getIPsSendgrid(poolName: string) {
    try {
      const ipsSendgrid = await this.sendGridHandler.getIPsByAccount();
      return ipsSendgrid.filter((ip) => ip.pools.includes(poolName) ?? false);
    } catch (e) {
      this.logger.warn(`SendGrid IP list unavailable: ${e?.response?.status ?? ''} ${e?.message ?? e}`);
      return [];
    }
  }

  async getAllIps() {
    try {
      return await this.sendGridHandler.getIPs();
    } catch (e) {
      this.logger.warn(`SendGrid IP list unavailable: ${e?.response?.status ?? ''} ${e?.message ?? e}`);
      return [];
    }
  }

  async getSendingLimits() {
    try {
      const redisClient = await this.redisService.getClient();
      const pools = await this.poolRepository
        .createQueryBuilder('pools')
        .where({ accountId: this.cls.get('accountId') })
        .innerJoin('messages', 'messages', 'messages.ippool = pools.pool_name')
        .getMany();

      const sendgridLimit = 10;
      const groupedPools = pools.reduce((chunckedArray, item, index) => {
        const chunkIndex = Math.floor(index / sendgridLimit);
        if (!chunckedArray[chunkIndex]) {
          chunckedArray[chunkIndex] = [];
        }

        chunckedArray[chunkIndex].push(item);

        return chunckedArray;
      }, []);

      const categoryStats = [];
      const yesterDay = new Date();
      yesterDay.setDate(yesterDay.getDate() - 1);

      for (const group of groupedPools) {
        const categories = group.map((item) => `pool_${item.poolName}`);
        const stats = await this.sendGridHandler.getStatsByCategories(yesterDay, yesterDay, categories);

        if (stats.length && stats[0].stats) {
          stats[0].stats.map(async (item) => {
            categoryStats.push({
              name: item.name,
              processed: item.metrics?.processed,
            });
          });
        }
      }

      for (const category of categoryStats) {
        const poolName = category.name.replace('pool_', '');
        const pool = await this.poolRepository.findOneOrFail({
          where: {
            poolName: poolName,
            accountId: this.cls.get('accountId'),
          },
        });

        const newSendingLimit = parseInt(category.processed + category.processed * 0.2);

        await this.poolRepository.update(pool.id, { sendingLimit: newSendingLimit });
        await redisClient.set(`pool_${poolName}:sending_limit`, newSendingLimit);
      }

      await redisClient.set(`spark_post:sending_limit`, process.env.LIMIT_SPARKPOST || 200);
      return categoryStats;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getPoolLimitDaily(poolName: string) {
    try {
      const redisClient = this.redisService.getClient();
      const currentDate = new Date().toISOString().split('T')[0];
      return await redisClient.get(`${poolName}:sent-by-day-${currentDate}`);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getIpsCount(accountId: number): Promise<number> {
    const pools = await this.poolRepository.find({ where: { accountId } });
    let countIp = 0;
    pools.forEach((pool) => {
      countIp += pool.ip ? JSON.parse(pool.ip).length : 0;
    });

    return countIp;
  }

  async poolsIpsCount(pools: Array<string>, accountId: number) {
    const ippools = await this.poolRepository.find({ where: { accountId, poolName: In(pools) } });
    const ips = new Set();
    ippools.forEach((pool) => {
      if (pool.ip) {
        (Array.isArray(pool.ip) ? pool.ip : JSON.parse(pool.ip)).forEach((ip) => {
          ips.add(ip);
        });
      }
    });
    return ips.size;
  }

  async getPoolsById(ids: Array<number>) {
    return await this.poolRepository.find({
      where: {
        id: In(ids),
      },
    });
  }
}
