import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditEntity } from '../../entities/audit.entity';
import { UserEntity } from '../../entities/users.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEntity)
    private readonly auditRepository: Repository<AuditEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findByEntityId(id: number): Promise<Array<AuditEntity & { userName?: string; userEmail?: string }>> {
    try {
      const audits = await this.auditRepository.find({
        where: { entityId: id },
        order: {
          createdAt: 'DESC',
        },
      });

      // Collect unique user IDs (the `user` column stores either a numeric ID or a JSON string)
      const userIds = new Set<number>();
      for (const audit of audits) {
        const parsed = Number(audit.user);
        if (!isNaN(parsed) && parsed > 0) userIds.add(parsed);
      }

      // Batch-fetch user names
      const userMap = new Map<number, { name: string; email: string }>();
      if (userIds.size > 0) {
        const users = await this.userRepository
          .createQueryBuilder('u')
          .select(['u.id', 'u.name', 'u.email'])
          .whereInIds([...userIds])
          .getMany();
        for (const u of users) {
          userMap.set(u.id, { name: u.name, email: u.email });
        }
      }

      // Enrich audits with resolved user details
      return audits.map((audit) => {
        const userId = Number(audit.user);
        const resolved = !isNaN(userId) && userId > 0 ? userMap.get(userId) : null;
        if (resolved) {
          return { ...audit, userName: resolved.name, userEmail: resolved.email };
        }
        // Legacy: user field is a JSON string with name/email
        try {
          const legacy = JSON.parse(audit.user);
          return { ...audit, userName: legacy?.name, userEmail: legacy?.email };
        } catch {
          return audit;
        }
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
