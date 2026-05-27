import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from '../../dtos/pagination.dto';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { Repository, In } from 'typeorm';
import { CustomFieldsDto } from './dto/custom-fields.dto';
import { CustomFieldsPageDto } from './dto/custom-fields-page.dto';
import { RedisService } from '../../providers/redis.provider';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { AccountCacheService } from '../accounts/account-cache.service';

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectRepository(CustomFieldsEntity)
    private readonly customFieldsRepository: Repository<CustomFieldsEntity>,
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountCacheService: AccountCacheService,
  ) {}

  async findAll(): Promise<Array<CustomFieldsEntity>> {
    try {
      return await this.customFieldsRepository.find({
        where: {
          accountId: this.cls.get('accountId'),
        },
        order: {
          createdAt: 'DESC',
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: CustomFieldsPageDto): Promise<PaginationDto<CustomFieldsEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'created_at';
      const order = params.order ? params.order : 'ASC';

      const customFieldsQuery = await this.customFieldsRepository
        .createQueryBuilder('custom_fields')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage || 0)
        .take(params.itemsPerPage)
        .orderBy(`custom_fields.${sortBy}`, `${order}`);

      if (params.title) {
        if (Array.isArray(params.title)) {
          const search = [params.title].flat();
          const customFieldsNames = search.map((customfields) => customfields.toUpperCase());

          customFieldsQuery.andWhere(`(custom_fields.name IN (:...name))`, { name: customFieldsNames });
        } else {
          customFieldsQuery.andWhere(`(custom_fields.name iLike :search OR custom_fields.description iLike :search OR custom_fields.title iLike :search)`, {
            search: `%${params.title}%`,
          });
        }
      }

      const [results, total] = await customFieldsQuery.getManyAndCount();

      return new PaginationDto<CustomFieldsEntity>({
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

  async findOneById(id: number): Promise<CustomFieldsEntity> {
    try {
      return await this.customFieldsRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findByName(names: string[]): Promise<CustomFieldsEntity[]> {
    try {
      return await this.customFieldsRepository.find({
        where: {
          name: In(names),
          accountId: this.cls.get('accountId'),
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(customFieldsDto: CustomFieldsDto): Promise<CustomFieldsEntity> {
    try {
      if (this.cls.get('accountId')) {
        customFieldsDto.accountId = this.cls.get('accountId');
      }

      const customField = this.customFieldsRepository.create(customFieldsDto);
      const redisClient = await this.redisService.getClient();
      const redisKeys = await redisClient.keys(`automations_tag:${customField.accountId}:*`); // TODO: Change it to use SCAN (non block)
      const deleteKeys = await redisKeys.map((key) => key);
      deleteKeys.push(`automations_push:${customField.accountId}`);
      await redisClient.del(deleteKeys);

      const savedCustomField = await this.customFieldsRepository.save(customField);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(savedCustomField.accountId);

      return savedCustomField;
    } catch (error) {
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Custom-field with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id: number, customFieldDto: CustomFieldsDto): Promise<CustomFieldsEntity> {
    const customField = await this.customFieldsRepository.findOneOrFail({
      where: { id, accountId: this.cls.get('accountId') },
    });

    try {
      this.customFieldsRepository.merge(customField, customFieldDto);
      const redisClient = await this.redisService.getClient();
      const redisKeys = await redisClient.keys(`automations_tag:${customField.accountId}:*`); // TODO: Change it to use SCAN (non block)
      const deleteKeys = await redisKeys.map((key) => key);
      deleteKeys.push(`automations_push:${customField.accountId}`);
      await redisClient.del(deleteKeys);
      await this.customFieldsRepository.update(id, customField);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(customField.accountId);

      return customField;
    } catch (error) {
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Custom-field with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: number) {
    const customField = await this.customFieldsRepository.findOneOrFail({
      where: { id, accountId: this.cls.get('accountId') },
    });

    try {
      const redisClient = await this.redisService.getClient();
      const redisKeys = await redisClient.keys(`automations_tag:${customField.accountId}:*`);
      const deleteKeys = await redisKeys.map((key) => key);
      deleteKeys.push(`automations_push:${customField.accountId}`);
      await redisClient.del(deleteKeys);

      const result = await this.customFieldsRepository.delete(id);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(customField.accountId);

      return result;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
