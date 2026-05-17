import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { SenderEntity } from '../../entities/sender.entity';
import { SendersDto, SyncResultDto } from './senders.dto';
import { NewSenderDto } from './new-sender.dto';
import { SenderPageDto } from './sender-page.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { SendgridHandler } from './../../handlers/email/sendgrid/sendgrid.handler';
import { hasEmojiCharacters } from '../../utils/utils.service';

@Injectable()
export class SendersService {
  private readonly logger = new Logger(SendersService.name);

  constructor(
    @InjectRepository(SenderEntity)
    private readonly senderRepository: Repository<SenderEntity>,
    private readonly sendGridHandler: SendgridHandler,
    private readonly cls: ClsService,
  ) {}

  async delete(id: number): Promise<void> {
    try {
      const sender = await this.senderRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
      sender.deletedAt = new Date();
      await this.senderRepository.save(sender);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Operators may only tune local config: sending_limit and sender_replyto_email.
   * Identity fields (email/name) are owned by SendGrid and only mutated by sync.
   */
  async edit(senderDto: SendersDto): Promise<SenderEntity> {
    const sender = await this.senderRepository.findOneOrFail({
      where: { id: senderDto.id, accountId: this.cls.get('accountId') },
    });

    try {
      // T4: operators may only tune sending_limit and sender_replyto_email.
      // is_default exists on the entity (decision #8) but is not editable here.
      if (senderDto.sendingLimit !== undefined) sender.sendingLimit = senderDto.sendingLimit;
      if (senderDto.senderReplyTo !== undefined) sender.senderReplyTo = senderDto.senderReplyTo;
      await this.senderRepository.update(sender.id, sender);
      return sender;
    } catch (error) {
      throw new HttpException(error.response || 'Internal Server Error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(senderDto: NewSenderDto, accountId?: number): Promise<SenderEntity> {
    senderDto.accountId = accountId ? accountId : this.cls.get('accountId');

    if (hasEmojiCharacters(senderDto.senderName)) {
      throw new ForbiddenException('Invalid character in Sender Name field');
    }

    try {
      const sender = this.senderRepository.create(senderDto);
      return await this.senderRepository.save(sender);
    } catch (error) {
      throw new HttpException(error.response || 'Internal Server Error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: SenderPageDto): Promise<PaginationDto<SenderEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'createdAt';
      const order = params.order ? params.order : 'ASC';
      const senderQuery = this.senderRepository
        .createQueryBuilder('senders')
        .where('account_id = :accountId', { accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`senders.${sortBy}`, `${order}`);

      if (params.name) {
        senderQuery.andWhere(`(senders.sender_name iLike :search OR senders.sender_email iLike :search)`, {
          search: `%${params.name}%`,
        });
      }

      const [results, total] = await senderQuery.getManyAndCount();

      return new PaginationDto<SenderEntity>({
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

  async listAll(params: SenderPageDto): Promise<Array<SenderEntity>> {
    try {
      const accountId = params.accountId || this.cls.get('accountId');
      return await this.senderRepository.find({
        where: { accountId },
        order: { createdAt: 'DESC' },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<SenderEntity> {
    try {
      return await this.senderRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneBySenderEmail(senderEmail: string, accountId: number): Promise<SenderEntity> {
    return await this.senderRepository.findOne({ where: { senderEmail, accountId } });
  }

  /**
   * One-way pull: SendGrid verified senders -> local `senders`.
   * Idempotency key is sg_verified_sender_id (decision #4); falls back to
   * sender_email only for local rows that still lack an id. Local config
   * (sending_limit/sender_replyto_email) is never overwritten on re-sync
   * (decisions #6/#10). Locals absent from SendGrid get removed_at_source set
   * (decision #6) — never hard-deleted.
   */
  async syncFromSendgrid(): Promise<SyncResultDto> {
    const accountId = this.cls.get('accountId');
    const remote: any[] = await this.sendGridHandler.getVerifiedSenders();
    const local = await this.senderRepository.find({ where: { accountId } });

    const consumed = new Set<number>();
    let created = 0;
    let updated = 0;

    for (const r of remote) {
      const remoteId = r.id != null ? String(r.id) : null;

      let match: SenderEntity | undefined;
      if (remoteId) {
        match = local.find((s) => s.sgVerifiedSenderId === remoteId && !consumed.has(s.id));
      }
      if (!match) {
        // Fallback only for rows that never received an id yet (no backfill
        // path here, but keeps re-sync of legacy rows idempotent — decision #4).
        match = local.find((s) => !s.sgVerifiedSenderId && s.senderEmail === r.from_email && !consumed.has(s.id));
      }

      if (!match) {
        const sender = this.senderRepository.create({
          accountId,
          senderEmail: r.from_email,
          senderName: r.from_name,
          senderReplyTo: r.reply_to ?? null,
          sgVerifiedSenderId: remoteId,
          removedAtSource: null,
        });
        await this.senderRepository.save(sender);
        created++;
        continue;
      }

      consumed.add(match.id);
      let dirty = false;
      if (!match.sgVerifiedSenderId && remoteId) {
        match.sgVerifiedSenderId = remoteId;
        dirty = true;
      }
      if (match.removedAtSource) {
        match.removedAtSource = null;
        dirty = true;
      }
      if (dirty) {
        await this.senderRepository.update(match.id, match);
        updated++;
      }
    }

    let removed = 0;
    for (const s of local) {
      if (!consumed.has(s.id) && !s.removedAtSource) {
        s.removedAtSource = new Date();
        await this.senderRepository.update(s.id, s);
        removed++;
      }
    }

    return { created, updated, removed };
  }
}
