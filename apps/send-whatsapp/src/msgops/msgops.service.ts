import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RedisService } from '../providers/redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { ShortLinkEntity } from './entities/short-link.entity';

@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(ShortLinkEntity)
    private readonly shortLinkRepository: Repository<ShortLinkEntity>,
    private readonly redisService: RedisService,
  ) {}

  async createShortLink(longUrl, baseUrl) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const result = await this.shortLinkRepository
      .createQueryBuilder('short_links')
      .insert()
      .values({
        longUrl,
        shortCode: this.generateShortCode(),
      })
      .onConflict(`("short_code") DO NOTHING`)
      .returning('*')
      .execute();
    if (!result.raw.length) {
      console.log('[CONFLICT] - DUPLICTED SHORT CODE.');
      return await this.createShortLink(longUrl, baseUrl);
    }
    await this.createRedisKey(result.raw[0]);
    return baseUrl + result.raw[0].short_code;
  }

  async createRedisKey(shortLink) {
    const redis = this.redisService.getOrThrow();
    const keyName = `redirect_short_link:${shortLink.short_code}`;
    const expireInDays = 7;
    await redis.set(`${keyName}`, shortLink.long_url, 'EX', 60 * 60 * 24 * expireInDays);
  }

  generateShortCode() {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
