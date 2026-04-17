import { LabelDto } from '@/modules/labels/dtos/label.dto';
import { LabelContentDto } from '@/modules/labels/dtos/labelContent.dto';

export class AutomationDto {
  id?: number;
  title: string;
  description?: string;
  verticalType?: string;
  name?: string;
  type?: string;
  stepId: number;
  isActive: boolean;
  isRateLimit: boolean;
  steps?: any;
  countSteps?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  labels?: LabelDto[];
  labelContent?: LabelContentDto[];

  constructor(automationDto: AutomationDto = {} as AutomationDto) {
    this.id = automationDto.id;
    this.title = automationDto.title;
    this.description = automationDto.description;
    this.verticalType = automationDto.verticalType;
    this.name = automationDto.name;
    this.type = automationDto.type;
    this.isActive = automationDto.isActive;
    this.isRateLimit = automationDto.isRateLimit;
    this.stepId = automationDto.stepId;
    this.countSteps = automationDto.countSteps;
    this.steps = automationDto.steps;
    this.createdAt = automationDto.createdAt;
    this.updatedAt = automationDto.updatedAt;
    this.deletedAt = automationDto.deletedAt;
    this.labels = automationDto.labels || [];
    this.labelContent = automationDto.labelContent || [];
  }
}
