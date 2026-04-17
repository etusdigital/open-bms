import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { WarmupEntity } from '../../entities/warmup.entity';
import { WarmupsDto } from './warmups.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { ClsService } from 'nestjs-cls';
import { CampaignsService } from '../campaigns/campaigns.service';
import { StatisticsService } from '../statistics/statistics.service';
import dayjs from 'dayjs';
import { WarmupStatus } from './warmups.interface';
import { WarmupPageDto } from './warmups.page.dto';

@Injectable()
export class WarmupsService {
  constructor(
    @InjectRepository(WarmupEntity)
    private readonly warmupRepository: Repository<WarmupEntity>,
    private readonly campaignsService: CampaignsService,
    private readonly statisticsService: StatisticsService,
    private readonly cls: ClsService,
  ) {}

  async create(warmupDto: WarmupsDto): Promise<WarmupEntity> {
    try {
      const campaign = await this.createCampaign(warmupDto);
      const warmup = this.warmupRepository.create(warmupDto);
      warmup.currentSend = 50;
      warmup.remainingSendToday = 50;
      warmup.stage = warmupDto.stage ? warmupDto.stage : 0;
      warmup.status = WarmupStatus.NOTSTARTED;
      warmup.campaignId = campaign.id;
      return await this.warmupRepository.save(warmup);
    } catch (error) {
      console.error(error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createCampaign(warmupDto: WarmupsDto) {
    return await this.campaignsService.createOne(
      {
        title: `warmup-${warmupDto.sender}`,
        name: `warmup-${warmupDto.sender}`,
        description: `warmup-${warmupDto.sender}`,
        type: 'simple',
        publisher: 'plusdin', // TODO: REMOVE THIS COLUMN
        scheduleTo: new Date(dayjs().add(1, 'day').format('YYYY-MM-DD HH:MM')),
        status: 0,
        campaignMessage: [],
        spreadSending: 480,
        confirmSaveDuplicate: false,
        messageType: 'email',
        steps: [],
        recurrenceSettings: null,
        isWarmup: true,
      },
      warmupDto.targetAccountId,
    );
  }

  async listPaginated(params: WarmupPageDto): Promise<PaginationDto<WarmupEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'createdAt';
      const order = params.order ? params.order : 'DESC';

      const warmupQuery = await this.warmupRepository
        .createQueryBuilder('warmups')
        // TODO: add filter by super-admin
        // .where('account_id = :accountId', { accountId: this.cls.get('accountId') })
        .where({
          ...(params.name && {
            sender: Like(`%${params.name}%`),
          }),
          ...(params.status && {
            status: params.status,
          }),
        })
        .leftJoinAndSelect('warmups.account', 'account')
        .leftJoinAndSelect('warmups.targetAccount', 'targetAccount', 'targetAccount.id = warmups.targetAccountId')
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`warmups.${sortBy}`, `${order}`);

      const [results, total] = await warmupQuery.getManyAndCount();

      return new PaginationDto<WarmupEntity>({
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

  async listAll(): Promise<Array<WarmupEntity>> {
    try {
      return await this.warmupRepository.find({
        where: { accountId: this.cls.get('accountId') },
        order: { createdAt: 'DESC' },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<WarmupEntity> {
    try {
      // TODO: add filter when not the super-admin: accountId: this.cls.get('accountId')
      return await this.warmupRepository
        .createQueryBuilder('warmups')
        .leftJoinAndSelect('warmups.account', 'account')
        .leftJoinAndSelect('warmups.targetAccount', 'targetAccount', 'targetAccount.id = warmups.targetAccountId')
        .where('warmups.id = :id', { id })
        .getOneOrFail();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      const warmup = await this.warmupRepository.findOneOrFail({ where: { id } });
      warmup.deletedAt = new Date();
      await this.warmupRepository.save(warmup);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async processTarget() {
    const warmups = await this.warmupRepository.find({ where: { status: WarmupStatus.RUNNING } });
    const currentDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    await Promise.all(
      warmups.map(async (warmup) => {
        if (warmup.currentSend >= warmup.target) {
          await this.warmupRepository.update(warmup.id, { remainingSendToday: warmup.currentSend });
          return true;
        }
        const statistics = await this.statisticsService.getCampaignStatistics(warmup.campaignId, currentDate);
        if (statistics.length) {
          await this.nextTargetWarmup(statistics[0], warmup, currentDate);
        }
      }),
    );
  }

  async nextTargetWarmup(statistics, warmup, date) {
    let nextValue = warmup.currentSend;
    const warmupInfo = warmup.warmupInfo || [];
    warmupInfo.push({ ...statistics, date });
    const isNextStep = this.isStepNextOrBack(warmupInfo, warmup.currentSend, 'next');
    if (isNextStep) {
      nextValue = this.calculateNext(warmup, false);
    } else if (this.isStepNextOrBack(warmupInfo, warmup.currentSend, 'back')) {
      nextValue = this.calculateNext(warmup, true);
    }
    await this.warmupRepository.update(warmup.id, { warmupInfo, currentSend: nextValue, remainingSendToday: nextValue });
  }

  calculateNext(warmup, stepBack) {
    const steps = [
      160, 224, 312, 440, 616, 864, 1208, 1688, 2360, 3304, 4632, 6480, 8000, 12696, 17776, 24888, 34848, 48784, 68664, 95624, 133872, 187416, 262384, 367336, 514272, 719984,
      1007976, 1411160, 1975624, 2765880, 3872232, 5421120, 7589568, 10625400, 14875552, 20825776,
    ];
    const index = steps.indexOf(warmup.currentSend);
    const nextIndex = stepBack ? index - 1 : index + 1;
    return index >= 0 && nextIndex >= 0 && steps.length >= nextIndex ? steps[nextIndex] : warmup.currentSend;
  }

  isStepNextOrBack(warmupInfo, currentSend, type) {
    if (!warmupInfo.length) {
      return false;
    }
    // const currentDay = dayjs().day();
    // if ([0, 6].includes(currentDay)) {
    //   return false;
    // }
    if (type === 'next') {
      const currentDay = warmupInfo[warmupInfo.length - 1];
      if (currentDay.delivered < currentSend * 0.8 || (currentDay.open / currentDay.delivered) * 100 < 15) {
        return false;
      }
      return true;
    }
    if (warmupInfo.length < 6) {
      return false;
    }
    const last6days = warmupInfo.slice(warmupInfo.length - 6);
    for (const [_index, day] of last6days.entries()) {
      if (type === 'back' && (day.open / day.delivered) * 100 >= 15) {
        return false;
      }
    }
    return true;
  }
}
