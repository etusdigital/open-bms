import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { PostmasterEntity } from 'src/entities/postmaster.entity';
import { Repository } from 'typeorm';
import { PostmasterDto } from './dto/postmaster.dto';
import { PoolEntity } from 'src/entities/pool.entity';

@Injectable()
export class PostmasterService {
  constructor(
    @InjectRepository(PostmasterEntity)
    private readonly postmasterRepository: Repository<PostmasterEntity>,
    @InjectRepository(PoolEntity)
    private readonly poolsRepository: Repository<PoolEntity>,
    private readonly cls: ClsService,
  ) {}

  async getDomainValues(params?: PostmasterDto) {
    try {
      const poolsQuery = await this.poolsRepository
        .createQueryBuilder('pools')
        .select("DISTINCT substring(sender_email from '@(.*)$')", 'domain')
        .where('pools.account_id = :accountId', { accountId: this.cls.get('accountId') })
        .andWhere((qb) => {
          const subQuery = qb.subQuery().select('1').from('postmaster', 'pm').where("pm.domain = substring(pools.senderEmail from '@(.*)$')").getQuery();

          return `EXISTS ${subQuery}`;
        })
        .getRawMany();

      const domainsResult = poolsQuery.map((items: any) => items.domain);
      if (!domainsResult.length) {
        return [];
      }

      const postmasterQuery = this.postmasterRepository.createQueryBuilder('postmaster').where('postmaster.domain IN (:...domains)', { domains: domainsResult });

      if (params.startDate && params.endDate) {
        postmasterQuery.andWhere('postmaster.date BETWEEN :startDate AND :endDate', {
          startDate: params.startDate,
          endDate: params.endDate,
        });
      }

      const postmasterResult = await postmasterQuery.orderBy('postmaster.date', 'ASC').getMany();

      return poolsQuery.reduce((posmasterArray, item) => {
        const postmasterDataArray = postmasterResult.filter((postmaster) => postmaster.domain === item.domain);
        let poolEntry = posmasterArray.find((pool: any) => pool.domain === item.domain);
        if (!poolEntry) {
          poolEntry = {
            domain: item.domain,
            dates: [],
          };
          posmasterArray.push(poolEntry);
        }

        postmasterDataArray.forEach((postmasterData) => {
          let dateEntry = poolEntry.dates.find((date: any) => date.date === postmasterData.date);

          if (!dateEntry) {
            dateEntry = {
              date: postmasterData.date,
              time: postmasterData.time,
              domainReputation: postmasterData.domainReputation?.toLowerCase(),
              spamRatio: postmasterData.spamRatio * 100,
              spfRatio: postmasterData.spfRatio * 100,
              dkimRatio: postmasterData.dkimRatio * 100,
              dmarcRatio: postmasterData.dmarcRatio * 100,
              inboundRatio: postmasterData.inboundRatio,
              spamLoops: postmasterData.spamLoops,
              deliveryErrors: postmasterData.deliveryErrors,
              ips: [],
            };
            poolEntry.dates.push(dateEntry);
          }

          dateEntry.ips.push({
            ip: postmasterData.ip,
            reputation: postmasterData.reputation?.toLowerCase(),
          });
        });
        return posmasterArray;
      }, []);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
