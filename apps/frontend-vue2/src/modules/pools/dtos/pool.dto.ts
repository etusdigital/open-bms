export class PoolDto {
  id?: number;
  name: string;
  description: string;
  poolName: string;
  ip: string;
  accountId?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  dailyLimit?: string;
  sendingLimit?: string;
  senderEmail: string;
  senderName: string;
  senderReplyTo: string;
  isDefault: boolean;
  senderCompost?: string;

  constructor(poolDto: PoolDto = {} as PoolDto) {
    this.id = poolDto.id;
    this.name = poolDto.name;
    this.description = poolDto.description;
    this.poolName = poolDto.poolName;
    this.ip = poolDto.ip;
    this.accountId = poolDto.accountId;
    this.createdAt = poolDto.createdAt;
    this.updatedAt = poolDto.updatedAt;
    this.deletedAt = poolDto.deletedAt;
    this.dailyLimit = poolDto.dailyLimit || '0';
    this.sendingLimit = poolDto.sendingLimit || '0';
    this.senderEmail = poolDto.senderEmail;
    this.senderName = poolDto.senderName;
    this.senderReplyTo = poolDto.senderReplyTo;
    this.isDefault = poolDto.isDefault || false;
    this.senderCompost = poolDto.senderCompost;
  }
}
