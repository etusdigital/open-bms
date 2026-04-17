import { Injectable, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { CampaignsConfigsDto, CampaignsRulesDto } from './campaigns-rules.dto';
import { CampaignsConfigsFilterDto, CampaignsRulesFilterDto } from './campaigns-rules-filter.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { ClsService } from 'nestjs-cls';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { CampaignsConfigsEntity } from 'src/entities/campaigns-configs.entity';
import { CampaignsRulesEntity } from 'src/entities/campaigns-rules.entity';
import { CampaignsRulesConfigsEntity } from 'src/entities/campaigns-rules-configs.entity';

@Injectable()
export class CampaignsRulesService {
  constructor(
    @InjectRepository(CampaignsConfigsEntity)
    private readonly campaignsConfigsRepository: Repository<CampaignsConfigsEntity>,
    @InjectRepository(CampaignsRulesEntity)
    private readonly campaignsRulesRepository: Repository<CampaignsRulesEntity>,
    private readonly cls: ClsService,
  ) {}

  async findAllRules(params: CampaignsRulesFilterDto): Promise<PaginationDto<CampaignsRulesDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'id';
      const order = (params.order || 'DESC') as 'ASC' | 'DESC';

      const query = this.campaignsRulesRepository
        .createQueryBuilder('campaigns_rules')
        .leftJoinAndSelect('campaigns_rules.campaignsRulesConfigs', 'campaigns_rules_configs')
        .leftJoinAndSelect('campaigns_rules_configs.campaignConfig', 'campaigns_configs')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`campaigns_rules.${sortBy}`, order);

      if (params.name) {
        query.andWhere(`(campaigns_rules.name ILIKE :search)`, {
          search: `%${params.name}%`,
        });
      }

      if (params.countOnly && params.countOnly === true) {
        const total = await query.getCount();
        return new PaginationDto<CampaignsRulesDto>({
          results: [],
          total,
        });
      }

      const [results, total] = await query.getManyAndCount();

      return new PaginationDto<CampaignsRulesDto>({
        results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async saveRule(campaignsRulesDto: CampaignsRulesDto): Promise<CampaignsRulesDto> {
    try {
      const queryRunner = this.campaignsRulesRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        campaignsRulesDto.accountId = this.cls.get('accountId');
        let configs = [];

        if (campaignsRulesDto.configs) {
          configs = await queryRunner.manager.find(CampaignsConfigsEntity, {
            where: {
              id: In(campaignsRulesDto.configs.map((config) => config.id)),
            },
          });
        }

        const entity = this.campaignsRulesRepository.create(campaignsRulesDto);
        const savedEntity = await queryRunner.manager.save(entity);

        if (configs.length > 0) {
          await queryRunner.manager.save(
            CampaignsRulesConfigsEntity,
            configs.map((config) => ({
              campaignRule: savedEntity,
              campaignConfig: config,
            })),
          );
        }

        await queryRunner.commitTransaction();

        return savedEntity;
      } catch (e) {
        await queryRunner.rollbackTransaction();
        if (e?.code === PostgresErrorCode.UniqueViolation) {
          throw new ForbiddenException('Campaign rule with that name already exists');
        }
        console.error(e);
        throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
      } finally {
        await queryRunner.release();
      }
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findRuleById(id: number): Promise<CampaignsRulesDto> {
    try {
      const result = await this.campaignsRulesRepository.findOne({
        where: { id, accountId: this.cls.get('accountId') },
      });

      if (!result) {
        throw new HttpException('Campaign rule not found', HttpStatus.NOT_FOUND);
      }

      return result;
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateRule(id: number, campaignsRulesDto: CampaignsRulesDto): Promise<CampaignsRulesDto> {
    const queryRunner = this.campaignsRulesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingRule = await this.campaignsRulesRepository.findOne({
        where: { id, accountId: this.cls.get('accountId') },
      });

      if (!existingRule) {
        throw new HttpException('Campaign rule not found', HttpStatus.NOT_FOUND);
      }

      let configs = [];
      if (campaignsRulesDto.configs) {
        configs = await queryRunner.manager.find(CampaignsConfigsEntity, {
          where: { id: In(campaignsRulesDto.configs.map((config) => config.id)) },
        });
      }

      delete campaignsRulesDto.configs;

      const entity = this.campaignsRulesRepository.create(campaignsRulesDto);
      const updatedEntity = await queryRunner.manager.save(entity);

      if (configs.length > 0) {
        const existingConfigs = await queryRunner.manager.find(CampaignsRulesConfigsEntity, {
          where: { campaignRuleId: updatedEntity.id },
          relations: ['campaignConfig'],
        });

        const configsToDelete = existingConfigs.filter((config) => !configs.includes(config.campaignConfig));

        if (configsToDelete.length > 0) {
          await queryRunner.manager.delete(
            CampaignsRulesConfigsEntity,
            configsToDelete.map((config) => config.id),
          );
        }

        await queryRunner.manager.save(
          CampaignsRulesConfigsEntity,
          configs.map((config) => ({
            campaignRule: updatedEntity,
            campaignConfig: config,
          })),
        );
      }

      await queryRunner.commitTransaction();

      return updatedEntity;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      console.error(e);
      if (e?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Campaign rule with that name already exists');
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteRule(id: number): Promise<void> {
    try {
      const result = await this.campaignsRulesRepository.delete({
        id,
        accountId: this.cls.get('accountId'),
      });

      if (result.affected === 0) {
        throw new HttpException('Campaign rule not found', HttpStatus.NOT_FOUND);
      }
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async validateRulesNames(params: CampaignsRulesFilterDto): Promise<CampaignsRulesEntity[]> {
    try {
      params.name = params.name.trim();

      return await this.campaignsRulesRepository
        .createQueryBuilder('campaigns_rules')
        .where({
          accountId: this.cls.get('accountId'),
          name: params.name,
          ...(params.id && { id: Not(params.id) }),
        })
        .getMany();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllConfigs(params: CampaignsConfigsFilterDto): Promise<PaginationDto<CampaignsConfigsDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'id';
      const order = (params.order || 'DESC') as 'ASC' | 'DESC';

      const query = this.campaignsConfigsRepository
        .createQueryBuilder('campaigns_configs')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`campaigns_configs.${sortBy}`, order);

      if (params.name) {
        query.andWhere(`(campaigns_configs.name ILIKE :search OR campaigns_configs.description ILIKE :search)`, {
          search: `%${params.name}%`,
        });
      }

      if (params.startDate && params.endDate) {
        query.andWhere('campaigns_configs.created_at BETWEEN :startDate AND :endDate', {
          startDate: params.startDate,
          endDate: params.endDate,
        });
      }

      if (params.countOnly && params.countOnly === true) {
        const total = await query.getCount();
        return new PaginationDto<CampaignsConfigsDto>({
          results: [],
          total,
        });
      }

      const [results, total] = await query.getManyAndCount();

      return new PaginationDto<CampaignsConfigsDto>({
        results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findConfigById(id: number): Promise<CampaignsConfigsDto> {
    try {
      const result = await this.campaignsConfigsRepository.findOne({
        where: { id, accountId: this.cls.get('accountId') },
      });

      if (!result) {
        throw new HttpException('Campaign rule not found', HttpStatus.NOT_FOUND);
      }

      return result;
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async saveConfig(campaignsConfigsDto: CampaignsConfigsDto): Promise<CampaignsConfigsDto> {
    try {
      campaignsConfigsDto.accountId = this.cls.get('accountId');
      const entity = this.campaignsConfigsRepository.create(campaignsConfigsDto);
      return await this.campaignsConfigsRepository.save(entity);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Campaign rule with that name already exists');
      }
      console.error(error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateConfig(id: number, campaignsConfigsDto: CampaignsConfigsDto): Promise<CampaignsConfigsDto> {
    try {
      const existingConfig = await this.campaignsConfigsRepository.findOne({
        where: { id, accountId: this.cls.get('accountId') },
      });

      if (!existingConfig) {
        throw new HttpException('Campaign config not found', HttpStatus.NOT_FOUND);
      }

      this.campaignsConfigsRepository.merge(existingConfig, campaignsConfigsDto);
      return await this.campaignsConfigsRepository.save(existingConfig);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Campaign rule with that name already exists');
      }
      console.error(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteConfig(id: number): Promise<void> {
    try {
      const result = await this.campaignsConfigsRepository.delete({
        id,
        accountId: this.cls.get('accountId'),
      });

      if (result.affected === 0) {
        throw new HttpException('Campaign config not found', HttpStatus.NOT_FOUND);
      }
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async validateConfigsNames(params: CampaignsConfigsFilterDto): Promise<CampaignsConfigsEntity[]> {
    try {
      params.name = params.name.trim();

      return await this.campaignsConfigsRepository
        .createQueryBuilder('campaigns_configs')
        .where({
          accountId: this.cls.get('accountId'),
          name: params.name,
          ...(params.id && { id: Not(params.id) }),
        })
        .getMany();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createCopy(id: number): Promise<CampaignsConfigsDto> {
    const configCopy = await this.campaignsConfigsRepository.findOne({ where: { id } });
    configCopy.configs.title += ' - copy';
    configCopy.name += ' - copy';

    delete configCopy.id;
    delete configCopy.createdAt;
    delete configCopy.updatedAt;

    return await this.saveConfig(configCopy);
  }
}
