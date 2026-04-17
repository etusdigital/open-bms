export enum WarmupStatus {
  NOTSTARTED = 'notStarted',
  RUNNING = 'running',
  TRANSFERRING = 'transferring',
  FINISHED = 'finished',
  DEACTIVATED = 'deactivated',
}

export class WarmupDto {
  id?: number;
  accountId: number;
  targetAccountId: number;
  sender: string;
  ippool: string;
  replyTo: string;
  target: number;
  campaignId?: number;
  targetSegmentId?: number;
  currentSend?: number;
  lastSentAt?: Date | undefined;
  status?: WarmupStatus | undefined;
  type: string;
  stage: number | null;
  description?: string | null;

  createdAt?: Date | string | undefined;
  updatedAt?: Date | undefined;
  deletedAt?: Date | undefined;

  constructor(warmupDto: WarmupDto = {} as WarmupDto) {
    this.id = warmupDto.id;
    this.accountId = warmupDto.accountId;
    this.sender = warmupDto.sender;
    this.ippool = warmupDto.ippool;
    this.replyTo = warmupDto.replyTo;
    this.target = warmupDto.target;
    this.currentSend = warmupDto.currentSend;
    this.targetAccountId = warmupDto.targetAccountId;
    this.campaignId = warmupDto.campaignId;
    this.targetSegmentId = warmupDto.targetSegmentId;
    this.lastSentAt = warmupDto.lastSentAt;
    this.type = warmupDto.type;
    this.stage = warmupDto.stage;
    this.description = warmupDto.description;

    this.createdAt = warmupDto.createdAt;
    this.updatedAt = warmupDto.updatedAt;
    this.deletedAt = warmupDto.deletedAt;
  }
}
