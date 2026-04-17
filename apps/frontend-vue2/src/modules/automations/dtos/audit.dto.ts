export class AuditDto {
  id?: number;
  entity?: string;
  entityId?: number;
  oldValues?: string;
  newValues?: string;
  user?: string;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;

  constructor(auditDto: AuditDto = {} as AuditDto) {
    this.id = auditDto.id;
    this.entity = auditDto.entity;
    this.entityId = auditDto.entityId;
    this.oldValues = auditDto.oldValues;
    this.newValues = auditDto.newValues;
    this.user = auditDto.user;
    this.ipAddress = auditDto.ipAddress;
    this.createdAt = auditDto.createdAt;
    this.updatedAt = auditDto.updatedAt;
    this.deletedAt = auditDto.deletedAt;
  }
}
