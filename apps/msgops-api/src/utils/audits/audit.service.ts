import { Injectable } from '@nestjs/common';
import { AuditEntity } from './../../entities/audit.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEntity)
    private readonly auditRepository: Repository<AuditEntity>,
  ) {}

  async createAudit(auditDto) {
    const audit = this.auditRepository.create(auditDto);
    return await this.auditRepository.save(audit);
  }
}
