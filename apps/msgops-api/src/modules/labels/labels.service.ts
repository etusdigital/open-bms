import { Injectable, HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { LabelsEntity } from '../../entities/labels.entity';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';
import { LabelsDto, LabelsContentsDto, CreateLabelContentDto, RemoveLabelContentDto } from './labels.dto';
import { LabelsFilterDto, LabelsContentsFilterDto } from './labels-filter.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { PostgresErrorCode } from 'src/shared.interfaces';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(LabelsEntity)
    private readonly labelsRepository: Repository<LabelsEntity>,
    @InjectRepository(LabelsContentsEntity)
    private readonly labelsContentsRepository: Repository<LabelsContentsEntity>,
    private readonly cls: ClsService,
  ) {}

  async findAll(params: LabelsFilterDto): Promise<PaginationDto<LabelsDto>> {
    const accountId = this.cls.get('accountId');
    const { page = 1, itemsPerPage = 10, sortBy = 'createdAt', order = 'DESC', includeDeleted = false } = params;
    const skip = (page - 1) * itemsPerPage;

    const queryBuilder = this.labelsRepository
      .createQueryBuilder('labels')
      .leftJoinAndSelect('labels.labelsContents', 'labelsContents')
      .where('labels.accountId = :accountId', { accountId });

    if (params.name) {
      queryBuilder.andWhere('labels.name ILIKE :name', { name: `%${params.name}%` });
    }

    if (params.description) {
      queryBuilder.andWhere('labels.description ILIKE :description', { description: `%${params.description}%` });
    }

    if (includeDeleted) {
      queryBuilder.withDeleted();
    }

    queryBuilder.orderBy(`labels.${sortBy}`, order);

    queryBuilder.skip(skip).take(itemsPerPage);

    const [labels, total] = await queryBuilder.getManyAndCount();

    return {
      results: labels,
      totalItems: total,
      page,
      itemsPerPage,
    };
  }

  async findLabelsContentByType(entityId: number, entityName: string) {
    return await this.labelsContentsRepository.find({
      where: {
        entityId,
        entityName,
      },
    });
  }

  async findOne(id: number): Promise<LabelsDto> {
    const accountId = this.cls.get('accountId');

    const label = await this.labelsRepository
      .createQueryBuilder('labels')
      .leftJoinAndSelect('labels.labelsContents', 'labelsContents')
      .where('labels.id = :id AND labels.accountId = :accountId', { id, accountId })
      .getOne();

    if (!label) {
      throw new NotFoundException(`Label with ID ${id} not found`);
    }

    return label;
  }

  async createOne(labelsDto: LabelsDto): Promise<LabelsDto> {
    const accountId = this.cls.get('accountId');

    try {
      const newLabel = this.labelsRepository.create({
        ...labelsDto,
        accountId,
      });

      const savedLabel = await this.labelsRepository.save(newLabel);
      return savedLabel;
    } catch (error) {
      if (error.code === PostgresErrorCode.UniqueViolation) {
        throw new BadRequestException(`Label with name "${labelsDto.name}" already exists for this account`);
      }
      throw new HttpException('Error creating label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(labelsDto: LabelsDto): Promise<LabelsDto> {
    if (!labelsDto.id) {
      throw new BadRequestException('Label ID is required');
    }

    const accountId = this.cls.get('accountId');

    const existingLabel = await this.labelsRepository.findOne({
      where: { id: labelsDto.id, accountId },
    });

    if (!existingLabel) {
      throw new NotFoundException(`Label with ID ${labelsDto.id} not found`);
    }

    try {
      const updatedLabel = this.labelsRepository.merge(existingLabel, labelsDto);
      await this.labelsRepository.update(labelsDto.id, updatedLabel);

      return updatedLabel;
    } catch (error) {
      if (error.code === PostgresErrorCode.UniqueViolation) {
        throw new BadRequestException(`Label with name "${labelsDto.name}" already exists for this account`);
      }
      throw new HttpException('Error updating label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteOne(id: number): Promise<void> {
    const accountId = this.cls.get('accountId');

    const label = await this.labelsRepository.findOne({
      where: { id, accountId },
    });

    if (!label) {
      return;
    }

    await this.labelsContentsRepository.delete({
      labelId: id,
    });

    label.deletedAt = new Date();
    label.name = `${label.name}-deleted-${label.id}`;

    await this.labelsRepository.save(label);
  }

  async syncEntityLabels(entityName: string, entityId: number, labelIds: number[]): Promise<LabelsContentsDto[]> {
    const accountId = this.cls.get('accountId');

    return await this.labelsContentsRepository.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.delete(LabelsContentsEntity, {
        entityName,
        entityId,
      });

      if (!labelIds || labelIds.length === 0) {
        return [];
      }

      const validLabels = await transactionalEntityManager.find(LabelsEntity, {
        where: {
          id: In(labelIds),
          accountId,
          deletedAt: null,
        },
        select: ['id'],
      });

      const validLabelIds = validLabels.map((l) => l.id);

      const invalidLabelIds = labelIds.filter((id) => !validLabelIds.includes(id));

      if (invalidLabelIds.length > 0) {
        throw new BadRequestException(`The following label IDs are invalid or do not belong to this account: ${invalidLabelIds.join(', ')}`);
      }

      const labelsToInsert = validLabelIds.map((labelId) =>
        transactionalEntityManager.create(LabelsContentsEntity, {
          labelId,
          entityName,
          entityId,
        }),
      );

      const insertedLabels = await transactionalEntityManager.save(LabelsContentsEntity, labelsToInsert);

      return insertedLabels;
    });
  }

  async findAllContents(params: LabelsContentsFilterDto): Promise<PaginationDto<LabelsContentsDto>> {
    const accountId = this.cls.get('accountId');
    const { page = 1, itemsPerPage = 10 } = params;
    const skip = (page - 1) * itemsPerPage;

    const queryBuilder = this.labelsContentsRepository
      .createQueryBuilder('labelsContents')
      .leftJoinAndSelect('labelsContents.label', 'label')
      .where('label.accountId = :accountId', { accountId });

    if (params.labelId) {
      queryBuilder.andWhere('labelsContents.labelId = :labelId', { labelId: params.labelId });
    }

    if (params.labelName) {
      queryBuilder.andWhere('label.name ILIKE :labelName', { labelName: `%${params.labelName}%` });
    }

    if (params.entityName) {
      queryBuilder.andWhere('labelsContents.entityName = :entityName', { entityName: params.entityName });
    }

    if (params.entityId) {
      queryBuilder.andWhere('labelsContents.entityId = :entityId', { entityId: params.entityId });
    }

    queryBuilder.skip(skip).take(itemsPerPage);

    const [contents, total] = await queryBuilder.getManyAndCount();

    return {
      results: contents,
      totalItems: total,
      page,
      itemsPerPage,
    };
  }

  async addLabelContents(createLabelContentDto: CreateLabelContentDto): Promise<LabelsContentsDto[]> {
    const results: LabelsContentsDto[] = [];

    for (const entityId of createLabelContentDto.entityIds) {
      const inserted = await this.syncEntityLabels(createLabelContentDto.entityName, entityId, [createLabelContentDto.labelId]);
      results.push(...inserted);
    }

    return results;
  }

  async removeLabelContents(removeLabelContentDto: RemoveLabelContentDto): Promise<void> {
    const accountId = this.cls.get('accountId');

    const label = await this.labelsRepository.findOne({
      where: { id: removeLabelContentDto.labelId, accountId },
    });

    if (!label) {
      throw new NotFoundException(`Label with ID ${removeLabelContentDto.labelId} not found`);
    }

    for (const entityId of removeLabelContentDto.entityIds) {
      await this.labelsContentsRepository.delete({
        labelId: removeLabelContentDto.labelId,
        entityName: removeLabelContentDto.entityName,
        entityId,
      });
    }
  }

  async getEntitiesByLabel(labelId: number, entityName?: string): Promise<LabelsContentsDto[]> {
    const accountId = this.cls.get('accountId');

    const label = await this.labelsRepository.findOne({
      where: { id: labelId, accountId },
    });

    if (!label) {
      throw new NotFoundException(`Label with ID ${labelId} not found`);
    }

    const queryBuilder = this.labelsContentsRepository
      .createQueryBuilder('labelsContents')
      .leftJoinAndSelect('labelsContents.label', 'label')
      .where('labelsContents.labelId = :labelId', { labelId });

    if (entityName) {
      queryBuilder.andWhere('labelsContents.entityName = :entityName', { entityName });
    }

    return await queryBuilder.getMany();
  }

  async getLabelsByEntity(entityName: string, entityId: number, fields: 'minimal' | 'full' = 'full'): Promise<LabelsDto[] | Array<{ id: number; name: string }>> {
    const accountId = this.cls.get('accountId');

    const queryBuilder = this.labelsRepository
      .createQueryBuilder('labels')
      .leftJoinAndSelect('labels.labelsContents', 'labelsContents')
      .where('labels.accountId = :accountId', { accountId })
      .andWhere('labels.deletedAt IS NULL')
      .andWhere('labelsContents.entityName = :entityName', { entityName })
      .andWhere('labelsContents.entityId = :entityId', { entityId });

    if (fields === 'minimal') {
      queryBuilder.select(['labels.id', 'labels.name']);
      const labels = await queryBuilder.getMany();
      return labels.map((l) => ({ id: l.id, name: l.name }));
    }

    return await queryBuilder.getMany();
  }

  async filterEntitiesByLabels(entityName: string, labelIds: number[]): Promise<number[]> {
    const accountId = this.cls.get('accountId');

    const labelsContents = await this.labelsContentsRepository
      .createQueryBuilder('labelsContents')
      .leftJoin('labelsContents.label', 'label')
      .where('label.accountId = :accountId', { accountId })
      .andWhere('labelsContents.labelId IN (:...labelIds)', { labelIds })
      .andWhere('labelsContents.entityName = :entityName', { entityName })
      .select('labelsContents.entityId')
      .getMany();

    return labelsContents.map((lc) => lc.entityId);
  }

  async saveEntityLabels(entityName: string, entityId: number, labels: Array<{ id: number; name?: string }> | undefined): Promise<void> {
    const labelIds = labels?.map((l) => l.id) || [];
    await this.syncEntityLabels(entityName, entityId, labelIds);
  }

  async saveEntityLabelsSafe(entityName: string, entityId: number, labels: Array<{ id: number; name?: string }> | undefined): Promise<{ success: boolean; error?: string }> {
    try {
      if (labels !== undefined) {
        await this.saveEntityLabels(entityName, entityId, labels);
        return { success: true };
      }
      return { success: true };
    } catch (error) {
      console.error(`Failed to save ${entityName} labels for entity ${entityId}:`, error);
      return { success: false, error: error.message };
    }
  }
}
