import { CampaignMessageType, CampaignsType, StatusCampaignEnum } from '@/modules/campaigns/enums/campaign.enum';
import { LabelDto } from '@/modules/labels/dtos/label.dto';
import { LabelContentDto } from '@/modules/labels/dtos/labelContent.dto';

export class CampaignsDto {
  id?: number;
  title: string;
  name: string;
  description: string;
  type: CampaignsType;
  publisher: string;
  scheduleTo: Date;
  testabScheduleTo: Date;
  testabScheduleEnd: Date;
  testabAudiencePercent: number;
  testabCriteria: string;
  testabSentAfterTest: boolean;
  isRateLimit: boolean;
  status: StatusCampaignEnum;
  steps: any;
  campaignMessage: any;
  spreadSending: number;
  confirmSaveDuplicate: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  messageType: CampaignMessageType;
  sendToAll: boolean;
  runSegment: boolean;
  sentContacts?: number;
  sentPercentage?: number;
  recurrenceCount?: number;
  sendAfterCreate?: boolean;
  recurrenceSettings: {
    date: Date;
    interval: number;
    frequency: number;
    weekDays?: number[];
    hasExpiration: boolean;
    untilDate?: Date | null;
    untilSend?: number | null;
    firstSentDate?: Date | null;
    lastSentDate?: Date | null;
  };
  labels?: LabelDto[];
  labelContent?: LabelContentDto[];

  constructor(campaignDto: CampaignsDto = {} as CampaignsDto) {
    this.id = campaignDto.id;
    this.title = campaignDto.title;
    this.name = campaignDto.name;
    this.description = campaignDto.description;
    this.type = campaignDto.type || 'simple';
    this.publisher = campaignDto.publisher || 'plusdin';
    this.scheduleTo = campaignDto.scheduleTo || new Date();
    this.testabScheduleTo = campaignDto.testabScheduleTo || new Date();
    this.testabScheduleEnd = campaignDto.testabScheduleEnd;
    this.testabAudiencePercent = campaignDto.testabAudiencePercent || 10;
    this.testabCriteria = campaignDto.testabCriteria || 'open';
    this.testabSentAfterTest = campaignDto.testabSentAfterTest || true;
    this.isRateLimit = campaignDto.isRateLimit || true;
    this.status = campaignDto.status;
    this.steps = campaignDto.steps || [];
    this.campaignMessage = campaignDto.campaignMessage || [];
    this.spreadSending = campaignDto.spreadSending || 60;
    this.confirmSaveDuplicate = campaignDto.confirmSaveDuplicate || false;
    this.createdAt = campaignDto.createdAt;
    this.updatedAt = campaignDto.updatedAt;
    this.deletedAt = campaignDto.deletedAt;
    this.messageType = campaignDto.messageType || 'email';
    this.sendToAll = campaignDto.sendToAll || false;
    this.runSegment = campaignDto.runSegment || false;
    this.sentContacts = campaignDto.sentContacts;
    this.sentPercentage = campaignDto.sentPercentage;
    this.recurrenceCount = campaignDto.recurrenceCount || 0;
    this.sendAfterCreate = campaignDto.sendAfterCreate || false;
    this.recurrenceSettings = campaignDto.recurrenceSettings || {
      date: new Date(),
      interval: 1,
      frequency: null,
      weekDays: [],
      hasExpiration: false,
      untilDate: null,
      untilSend: null,
      firstSentDate: null,
      lastSentDate: null,
    };
    this.labels = campaignDto.labels || [];
    this.labelContent = campaignDto.labelContent || [];
  }
}
